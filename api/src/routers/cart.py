import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from src.auth.deps import get_current_user
from src.db.cart_repo import get_or_create_cart_id
from src.db.connection import get_pool
from src.schemas.cart import (
    CartItemIn,
    CartItemOptionOut,
    CartItemOut,
    CartItemUpdateIn,
    CartOut,
)

router = APIRouter(prefix="/api/cart", tags=["Cart"])


def options_cost(unit_prices: list[float], free_count: int) -> float:
    """
    Вартість опцій однієї групи з урахуванням безкоштовної квоти.

    Кожна обрана порція — окрема одиниця, тож два кетчупи це [20, 20].
    Безкоштовними йдуть НАЙДОРОЖЧІ одиниці: клієнту вигідніше, а порядок
    визначений — інакше бекенд і фронт порахували б різні суми на групі,
    де позиції коштують по-різному.
    """
    chargeable = sorted(unit_prices, reverse=True)[free_count:]
    return round(sum(chargeable), 2)


def build_options_key(options) -> str:
    """
    Відбиток вибору опцій для унікального ключа позиції кошика.

    Рахує саме бекенд: якби ключ формував клієнт, інший порядок тих самих
    опцій дав би інший рядок, і в кошику з'явилися б два однакові товари.
    Кількість — обов'язкова частина ключа: без неї «1 кетчуп» і «2 кетчупи»
    злилися б в одну позицію, і кількість соусів поїхала б.
    """
    ordered = sorted(options, key=lambda o: (o.group_id, o.variant_id))
    return "|".join(f"{o.group_id}:{o.variant_id}:{o.qty}" for o in ordered)


async def _fetch_cart(pool: asyncpg.Pool, telegram_id: int) -> CartOut:
    """
    Витягує кошик разом із вибраними опціями.

    Двома запитами, а не одним із jsonb_agg: безкоштовна квота вимагає
    розгортання вибору по окремих одиницях, а це в SQL виходить громіздко
    (generate_series усередині агрегату). У Python — три рядки.
    """
    items_query = """
        SELECT ci.id, p.id AS product_id, p.name AS product_name,
               pv.label AS variant_label, pv.weight, pv.price, ci.qty
        FROM cart_items ci
        JOIN product_variants pv ON pv.id = ci.variant_id
        JOIN products p ON p.id = pv.product_id
        JOIN carts c ON c.id = ci.cart_id
        WHERE c.telegram_id = $1
        ORDER BY ci.id
    """
    # free_count живе на парі (товар кошика, група), тож піднімаємось від
    # позиції кошика через її варіант до товару й уже звідти до звʼязку.
    options_query = """
        SELECT cio.cart_item_id, cio.group_id, cio.variant_id, cio.qty,
               op.name, opv.label, ogi.price_delta, pog.free_count
        FROM cart_item_options cio
        JOIN cart_items ci ON ci.id = cio.cart_item_id
        JOIN carts c ON c.id = ci.cart_id
        JOIN option_group_items ogi
             ON ogi.group_id = cio.group_id AND ogi.variant_id = cio.variant_id
        JOIN product_variants opv ON opv.id = cio.variant_id
        JOIN products op ON op.id = opv.product_id
        JOIN product_variants cv ON cv.id = ci.variant_id
        JOIN product_option_groups pog
             ON pog.product_id = cv.product_id AND pog.group_id = cio.group_id
        WHERE c.telegram_id = $1
        ORDER BY cio.cart_item_id, pog.sort_order, ogi.sort_order
    """
    async with pool.acquire() as conn:
        item_rows = await conn.fetch(items_query, telegram_id)
        option_rows = await conn.fetch(options_query, telegram_id)

    # Опції за позицією кошика, і всередині — за групою: квота діє на групу
    by_item: dict[int, dict[int, list[asyncpg.Record]]] = {}
    for row in option_rows:
        by_item.setdefault(row["cart_item_id"], {}).setdefault(row["group_id"], []).append(row)

    items: list[CartItemOut] = []
    total = 0.0
    for item in item_rows:
        groups = by_item.get(item["id"], {})
        options: list[CartItemOptionOut] = []
        extra = 0.0

        for rows in groups.values():
            units: list[float] = []
            for row in rows:
                delta = float(row["price_delta"])
                units.extend([delta] * row["qty"])
                options.append(
                    CartItemOptionOut(
                        group_id=row["group_id"],
                        variant_id=row["variant_id"],
                        name=row["name"],
                        label=row["label"],
                        price_delta=delta,
                        qty=row["qty"],
                    )
                )
            
            effective_free = rows[0]["free_count"] * item["qty"]
            extra += options_cost(units, effective_free)

        price = float(item["price"])
        subtotal = round((price + extra) * item["qty"], 2)
        total += subtotal

        items.append(
            CartItemOut(
                id=item["id"],
                product_id=item["product_id"],
                product_name=item["product_name"],
                variant_label=item["variant_label"],
                weight=item["weight"],
                price=price,
                qty=item["qty"],
                subtotal=subtotal,
                options=options,
            )
        )

    return CartOut(items=items, total=round(total, 2))


@router.get("", response_model=CartOut)
async def get_cart(
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool)
):
    """Отримує вміст кошика для поточного користувача."""
    return await _fetch_cart(pool, user["telegram_id"])


@router.post("/items", response_model=CartOut)
async def add_item_to_cart(
    payload: CartItemIn,
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool)
):

    seen_opts = set()
    for opt in payload.options:
        pair = (opt.group_id, opt.variant_id)
        if pair in seen_opts:
            raise HTTPException(status_code=400, detail="Дублювання опцій у запиті")
        seen_opts.add(pair)
        
    async with pool.acquire() as conn, conn.transaction():
        variant = await conn.fetchrow("""
            SELECT p.id as product_id, p.is_available as p_avail, pv.is_available as pv_avail 
            FROM product_variants pv
            JOIN products p ON p.id = pv.product_id
            WHERE pv.id = $1
        """, payload.variant_id)
        
        if not variant:
            raise HTTPException(status_code=404, detail="Варіант не знайдено")
        if not variant["p_avail"] or not variant["pv_avail"]:
            raise HTTPException(status_code=409, detail="Товар або варіант недоступний")

        product_id = variant["product_id"]

        groups = await conn.fetch("""
            SELECT group_id, min_select, max_select 
            FROM product_option_groups 
            WHERE product_id = $1
        """, product_id)
        group_rules = {row["group_id"]: row for row in groups}

        requested_groups = {}
        for opt in payload.options:
            if opt.group_id not in group_rules:
                raise HTTPException(
                    status_code=400,
                    detail=f"Група {opt.group_id} не належить товару",
                )
            requested_groups.setdefault(opt.group_id, []).append(opt)

        for g_id, rule in group_rules.items():
            # Саме одиниці, а не рядки: два кетчупи приходять одним рядком
            # із qty = 2, і len() порахував би їх за один.
            count = sum(o.qty for o in requested_groups.get(g_id, []))

            effective_min = rule["min_select"] * payload.qty
            effective_max = rule["max_select"] * payload.qty
            
            if count < effective_min or count > effective_max:
                raise HTTPException(
                    status_code=400, 
                    detail=(
                        f"Група {g_id}: вибрано {count}, "
                        f"дозволено {rule['min_select']}-{rule['max_select']}"
                    ),
                )

        if payload.options:
            allowed_opts = await conn.fetch("""
                SELECT group_id, variant_id 
                FROM option_group_items 
                WHERE group_id = ANY($1) AND is_available = true
            """, list(group_rules.keys()))
            allowed_set = {(row["group_id"], row["variant_id"]) for row in allowed_opts}
            
            for opt in payload.options:
                if (opt.group_id, opt.variant_id) not in allowed_set:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Опція {opt.group_id}:{opt.variant_id} недоступна",
                    )

        sorted_opts = sorted(payload.options, key=lambda x: (x.group_id, x.variant_id))
        options_key = build_options_key(payload.options)

        cart_id = await get_or_create_cart_id(conn, user["telegram_id"])

        upsert_query = """
            INSERT INTO cart_items (cart_id, variant_id, qty, options_key)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (cart_id, variant_id, options_key) DO UPDATE
            SET qty = cart_items.qty + EXCLUDED.qty
            RETURNING id, (xmax = 0) AS is_insert
        """
        row = await conn.fetchrow(
            upsert_query, cart_id, payload.variant_id, payload.qty, options_key
        )
        cart_item_id = row["id"]

        if row["is_insert"] and sorted_opts:
            opts_data = [(cart_item_id, o.group_id, o.variant_id, o.qty) for o in sorted_opts]
            await conn.executemany("""
                INSERT INTO cart_item_options (cart_item_id, group_id, variant_id, qty)
                VALUES ($1, $2, $3, $4)
            """, opts_data)

    return await _fetch_cart(pool, user["telegram_id"])

@router.patch("/items/{item_id}", response_model=CartOut)
async def update_cart_item(
    item_id: int,
    payload: CartItemUpdateIn,
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool)
):
    """
    Оновлює кількість товару в кошику.

    Позиції з обраними опціями (соуси, напої) ревалідуються: якщо новий qty
    зсуває effective_min/max (= min_select/max_select * qty) так, що поточний
    вибір опцій більше не вкладається — запит відхиляється. Інакше кількість
    безкоштовних/платних порцій розійшлася б із тим, що юзер реально обирав
    на картці товару (саме це стається без цієї перевірки: 2 соуси на 1 порцію
    товару замість очікуваних 2 порцій).

    Працює в обидва боки: і зменшення qty може порушити effective_max
    (забагато соусу лишилось), і збільшення — effective_min (бракує напою
    на другий бокс).
    """
    async with pool.acquire() as conn, conn.transaction():
        # FOR UPDATE — лочимо рядок: паралельний PATCH на той самий item_id
        # інакше міг би проскочити повз перевірку між SELECT і UPDATE.
        item = await conn.fetchrow(
            """
            SELECT ci.id, pv.product_id
            FROM cart_items ci
            JOIN carts c ON c.id = ci.cart_id
            JOIN product_variants pv ON pv.id = ci.variant_id
            WHERE ci.id = $1 AND c.telegram_id = $2
            FOR UPDATE OF ci
            """,
            item_id, user["telegram_id"],
        )
        if item is None:
            raise HTTPException(status_code=404, detail="Товар не знайдено в кошику")

        rules = await conn.fetch(
            """
            SELECT group_id, min_select, max_select
            FROM product_option_groups
            WHERE product_id = $1
            """,
            item["product_id"],
        )

        if rules:
            selected = await conn.fetch(
                "SELECT group_id, qty FROM cart_item_options WHERE cart_item_id = $1",
                item_id,
            )
            selected_counts: dict[int, int] = {}
            for row in selected:
                selected_counts[row["group_id"]] = (
                    selected_counts.get(row["group_id"], 0) + row["qty"]
                )

            for rule in rules:
                effective_min = rule["min_select"] * payload.qty
                effective_max = rule["max_select"] * payload.qty
                count = selected_counts.get(rule["group_id"], 0)
                if count < effective_min or count > effective_max:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            f"Нова кількість не узгоджується з обраними опціями "
                            f"(група {rule['group_id']}: обрано {count}, "
                            f"дозволено {effective_min}-{effective_max} "
                            f"при кількості {payload.qty}). "
                            "Видаліть позицію і додайте знову з новою кількістю."
                        ),
                    )

        await conn.execute(
            "UPDATE cart_items SET qty = $1 WHERE id = $2", payload.qty, item_id
        )

    return await _fetch_cart(pool, user["telegram_id"])


@router.delete("/items/{item_id}", response_model=CartOut)
async def delete_cart_item(
    item_id: int,
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool)
):
    """
    Видаляє товар з кошика.
    """
    delete_query = """
        DELETE FROM cart_items
        USING carts
        WHERE cart_items.cart_id = carts.id
          AND cart_items.id = $1
          AND carts.telegram_id = $2
    """
    async with pool.acquire() as conn:
        result = await conn.execute(delete_query, item_id, user["telegram_id"])

        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Товар не знайдено в кошику")

    return await _fetch_cart(pool, user["telegram_id"])


@router.delete("", response_model=CartOut)
async def clear_cart(
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool)
):
    """
    Повністю очищає кошик. Сам кошик (`carts`) не видаляємо — лише позиції,
    щоб не смикати get_or_create_cart_id при наступному додаванні.
    Порожній кошик — не помилка, тож 404 тут не кидаємо.
    """
    clear_query = """
        DELETE FROM cart_items
        USING carts
        WHERE cart_items.cart_id = carts.id
          AND carts.telegram_id = $1
    """
    async with pool.acquire() as conn:
        await conn.execute(clear_query, user["telegram_id"])

    return await _fetch_cart(pool, user["telegram_id"])