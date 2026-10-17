import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from src.auth.deps import get_current_user
from src.db.cart_repo import get_or_create_cart_id
from src.db.connection import get_pool
from src.middleware.rate_limiter import rate_limiter
from src.schemas.cart import CartItemIn, CartItemUpdateIn, CartOut
from src.services.cart_helpers import build_options_key, options_cost
from src.services.cart_service import _fetch_cart

__all__ = ["build_options_key", "options_cost", "_fetch_cart", "router"]

router = APIRouter(prefix="/api/cart", tags=["Cart"], dependencies=[Depends(rate_limiter)])


@router.get("", response_model=CartOut)
async def get_cart(user=Depends(get_current_user), pool: asyncpg.Pool = Depends(get_pool)):
    """Отримує вміст кошика для поточного користувача."""
    return await _fetch_cart(pool, user["telegram_id"])


@router.post("/items", response_model=CartOut)
async def add_item_to_cart(
    payload: CartItemIn, user=Depends(get_current_user), pool: asyncpg.Pool = Depends(get_pool)
):

    seen_opts = set()
    for opt in payload.options:
        pair = (opt.group_id, opt.variant_id)
        if pair in seen_opts:
            raise HTTPException(status_code=400, detail="Дублювання опцій у запиті")
        seen_opts.add(pair)

    async with pool.acquire() as conn, conn.transaction():
        variant = await conn.fetchrow(
            """
            SELECT p.id as product_id, p.is_available as p_avail, pv.is_available as pv_avail 
            FROM product_variants pv
            JOIN products p ON p.id = pv.product_id
            WHERE pv.id = $1
            """,
            payload.variant_id,
        )

        if not variant:
            raise HTTPException(status_code=404, detail="Варіант не знайдено")
        if not variant["p_avail"] or not variant["pv_avail"]:
            raise HTTPException(status_code=409, detail="Товар або варіант недоступний")

        product_id = variant["product_id"]

        groups = await conn.fetch(
            """
            SELECT group_id, min_select, max_select 
            FROM product_option_groups 
            WHERE product_id = $1
        """,
            product_id,
        )
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
            allowed_opts = await conn.fetch(
                """
                SELECT group_id, variant_id 
                FROM option_group_items 
                WHERE group_id = ANY($1) AND is_available = true
            """,
                list(group_rules.keys()),
            )
            allowed_set = {(row["group_id"], row["variant_id"]) for row in allowed_opts}

            for opt in payload.options:
                if (opt.group_id, opt.variant_id) not in allowed_set:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Опція {opt.group_id}:{opt.variant_id} недоступна",
                    )

        sorted_opts = sorted(payload.options, key=lambda x: (x.group_id, x.variant_id))
        options_key = build_options_key(payload.options, item_qty=payload.qty)

        cart_id = await get_or_create_cart_id(conn, user["telegram_id"])

        existing_qty = await conn.fetchval(
            """
            SELECT qty FROM cart_items
            WHERE cart_id = $1 AND variant_id = $2 AND options_key = $3
            """,
            cart_id,
            payload.variant_id,
            options_key,
        )
        if existing_qty and (existing_qty + payload.qty) > 50:
            raise HTTPException(
                status_code=400,
                detail="Максимальна кількість однієї страви в кошику — 50 шт.",
            )

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

        if row["is_insert"]:
            if sorted_opts:
                opts_data = [(cart_item_id, o.group_id, o.variant_id, o.qty) for o in sorted_opts]
                await conn.executemany(
                    """
                    INSERT INTO cart_item_options (cart_item_id, group_id, variant_id, qty)
                    VALUES ($1, $2, $3, $4)
                """,
                    opts_data,
                )
        else:
            if sorted_opts:
                await conn.executemany(
                    """
                    UPDATE cart_item_options
                    SET qty = qty + $1
                    WHERE cart_item_id = $2 AND group_id = $3 AND variant_id = $4
                    """,
                    [(o.qty, cart_item_id, o.group_id, o.variant_id) for o in sorted_opts],
                )
        return await _fetch_cart(conn, user["telegram_id"])


@router.patch("/items/{item_id}", response_model=CartOut)
async def update_cart_item(
    item_id: int,
    payload: CartItemUpdateIn,
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Оновлює товар у кошику (кількість, варіант або обрані опції).

    Якщо передано payload.options:
    - Повністю ревалідуються правила груп опцій для вказаної (або поточної) кількості товару.
    - Якщо в кошику вже є така сама позиція (той самий варіант і той самий набір опцій),
      вони зливаються в одну з сумарною кількістю.
    - Інакше поточна позиція оновлюється на місці.

    Якщо передано лише payload.qty (без options):
    - Зберігається пропорційне масштабування раніше обраних опцій.
    """
    async with pool.acquire() as conn, conn.transaction():
        item = await conn.fetchrow(
            """
            SELECT ci.id, ci.cart_id, ci.qty, ci.variant_id, pv.product_id
            FROM cart_items ci
            JOIN carts c ON c.id = ci.cart_id
            JOIN product_variants pv ON pv.id = ci.variant_id
            WHERE ci.id = $1 AND c.telegram_id = $2
            FOR UPDATE OF ci
            """,
            item_id,
            user["telegram_id"],
        )
        if item is None:
            raise HTTPException(status_code=404, detail="Товар не знайдено в кошику")

        if payload.options is not None:
            target_variant_id = (
                payload.variant_id if payload.variant_id is not None else item["variant_id"]
            )
            target_qty = payload.qty if payload.qty is not None else item["qty"]

            variant = await conn.fetchrow(
                """
                SELECT p.id as product_id, p.is_available as p_avail, pv.is_available as pv_avail 
                FROM product_variants pv
                JOIN products p ON p.id = pv.product_id
                WHERE pv.id = $1
                """,
                target_variant_id,
            )
            if not variant:
                raise HTTPException(status_code=404, detail="Варіант не знайдено")
            if not variant["p_avail"] or not variant["pv_avail"]:
                raise HTTPException(status_code=409, detail="Товар або варіант недоступний")

            product_id = variant["product_id"]

            groups = await conn.fetch(
                """
                SELECT group_id, min_select, max_select 
                FROM product_option_groups 
                WHERE product_id = $1
                """,
                product_id,
            )
            group_rules = {row["group_id"]: row for row in groups}

            seen_opts = set()
            requested_groups: dict[int, list] = {}
            for opt in payload.options:
                pair = (opt.group_id, opt.variant_id)
                if pair in seen_opts:
                    raise HTTPException(status_code=400, detail="Дублювання опцій у запиті")
                seen_opts.add(pair)

                if opt.group_id not in group_rules:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Група {opt.group_id} не належить товару",
                    )
                requested_groups.setdefault(opt.group_id, []).append(opt)

            for g_id, rule in group_rules.items():
                count = sum(o.qty for o in requested_groups.get(g_id, []))
                effective_min = rule["min_select"] * target_qty
                effective_max = rule["max_select"] * target_qty

                if count < effective_min or count > effective_max:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Група {g_id}: вибрано {count}, "
                            f"дозволено {rule['min_select']}-{rule['max_select']}"
                        ),
                    )

            if payload.options:
                allowed_opts = await conn.fetch(
                    """
                    SELECT group_id, variant_id 
                    FROM option_group_items 
                    WHERE group_id = ANY($1) AND is_available = true
                    """,
                    list(group_rules.keys()),
                )
                allowed_set = {(row["group_id"], row["variant_id"]) for row in allowed_opts}

                for opt in payload.options:
                    if (opt.group_id, opt.variant_id) not in allowed_set:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Опція {opt.group_id}:{opt.variant_id} недоступна",
                        )

            sorted_opts = sorted(payload.options, key=lambda x: (x.group_id, x.variant_id))
            options_key = build_options_key(payload.options, item_qty=payload.qty)
            cart_id = item["cart_id"]

            # Перевіряємо, чи є в кошику інша позиція з таким же варіантом і опціями
            other_item = await conn.fetchrow(
                """
                SELECT id, qty FROM cart_items
                WHERE cart_id = $1 AND variant_id = $2 AND options_key = $3 AND id != $4
                """,
                cart_id,
                target_variant_id,
                options_key,
                item_id,
            )

            if other_item:
                # Зливаємо поточну позицію в іншу існуючу
                merged_qty = other_item["qty"] + target_qty
                other_id = other_item["id"]

                await conn.execute("DELETE FROM cart_items WHERE id = $1", item_id)
                await conn.execute(
                    "UPDATE cart_items SET qty = $1 WHERE id = $2", merged_qty, other_id
                )
                await conn.execute(
                    "DELETE FROM cart_item_options WHERE cart_item_id = $1", other_id
                )

                if sorted_opts:
                    opts_data = []
                    for o in sorted_opts:
                        if target_qty > 0 and o.qty % target_qty == 0:
                            new_opt_qty = (o.qty // target_qty) * merged_qty
                        else:
                            ratio = o.qty // target_qty if target_qty > 0 else 0
                            new_opt_qty = o.qty + ratio * other_item["qty"]
                        opts_data.append((other_id, o.group_id, o.variant_id, new_opt_qty))

                    await conn.executemany(
                        """
                        INSERT INTO cart_item_options (cart_item_id, group_id, variant_id, qty)
                        VALUES ($1, $2, $3, $4)
                        """,
                        opts_data,
                    )
            else:
                # Оновлюємо поточну позицію на місці
                await conn.execute(
                    """
                    UPDATE cart_items
                    SET variant_id = $1, qty = $2, options_key = $3
                    WHERE id = $4
                    """,
                    target_variant_id,
                    target_qty,
                    options_key,
                    item_id,
                )
                await conn.execute("DELETE FROM cart_item_options WHERE cart_item_id = $1", item_id)
                if sorted_opts:
                    opts_data = [(item_id, o.group_id, o.variant_id, o.qty) for o in sorted_opts]
                    await conn.executemany(
                        """
                        INSERT INTO cart_item_options (cart_item_id, group_id, variant_id, qty)
                        VALUES ($1, $2, $3, $4)
                        """,
                        opts_data,
                    )
        elif payload.qty is not None:
            old_qty = item["qty"]
            new_qty = payload.qty

            if new_qty != old_qty:
                rules = await conn.fetch(
                    """
                    SELECT group_id, min_select, max_select
                    FROM product_option_groups
                    WHERE product_id = $1
                    """,
                    item["product_id"],
                )

                selected = await conn.fetch(
                    """
                    SELECT group_id, variant_id, qty 
                    FROM cart_item_options 
                    WHERE cart_item_id = $1 
                    ORDER BY group_id, variant_id
                    """,
                    item_id,
                )

                # Якщо є опції та правила — пробуємо пропорційно масштабувати
                if selected and rules:
                    is_proportional = all(r["qty"] % old_qty == 0 for r in selected)

                    if is_proportional:
                        # Рахуємо масштабовані кількості
                        scaled_options = []
                        new_group_totals: dict[int, int] = {}
                        for r in selected:
                            unit_qty = r["qty"] // old_qty
                            scaled_qty = unit_qty * new_qty
                            scaled_options.append((r["group_id"], r["variant_id"], scaled_qty))
                            new_group_totals[r["group_id"]] = (
                                new_group_totals.get(r["group_id"], 0) + scaled_qty
                            )

                        # Перевіряємо валідність масштабованих опцій проти правил
                        valid = True
                        for rule in rules:
                            eff_min = rule["min_select"] * new_qty
                            eff_max = rule["max_select"] * new_qty
                            count = new_group_totals.get(rule["group_id"], 0)
                            if count < eff_min or count > eff_max:
                                valid = False
                                break

                        if valid:
                            await conn.executemany(
                                """
                                UPDATE cart_item_options 
                                SET qty = $1 
                                WHERE cart_item_id = $2 AND group_id = $3 AND variant_id = $4
                                """,
                                [
                                    (s_qty, item_id, g_id, v_id)
                                    for g_id, v_id, s_qty in scaled_options
                                ],
                            )

                            # Перераховуємо options_key (нормалізований на 1 порцію)
                            ordered = sorted(scaled_options, key=lambda o: (o[0], o[1]))
                            new_key = "|".join(
                                f"{g}:{v}:{s_qty // new_qty if s_qty % new_qty == 0 else s_qty}"
                                for g, v, s_qty in ordered
                            )

                            await conn.execute(
                                "UPDATE cart_items SET qty = $1, options_key = $2 WHERE id = $3",
                                new_qty,
                                new_key,
                                item_id,
                            )
                        else:
                            raise HTTPException(
                                status_code=409,
                                detail=(
                                    "Кількість вибраних опцій неможливо автоматично масштабувати. "
                                    "Будь ласка, налаштуйте страву в меню."
                                ),
                            )
                    else:
                        raise HTTPException(
                            status_code=409,
                            detail=(
                                "Опції вибрано несиметрично. "
                                "Будь ласка, налаштуйте страву в меню з новою кількістю."
                            ),
                        )
                else:
                    # Опцій немає — перевіряємо, чи не з'явилися обов'язкові опції
                    for rule in rules:
                        if rule["min_select"] * new_qty > 0:
                            raise HTTPException(
                                status_code=409,
                                detail=(
                                    "Страва потребує вибору обов'язкових опцій. "
                                    "Налаштуйте страву в меню."
                                ),
                            )
                    await conn.execute(
                        "UPDATE cart_items SET qty = $1 WHERE id = $2", new_qty, item_id
                    )

        return await _fetch_cart(conn, user["telegram_id"])


@router.delete("/items/{item_id}", response_model=CartOut)
async def delete_cart_item(
    item_id: int, user=Depends(get_current_user), pool: asyncpg.Pool = Depends(get_pool)
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

        return await _fetch_cart(conn, user["telegram_id"])


@router.delete("", response_model=CartOut)
async def clear_cart(user=Depends(get_current_user), pool: asyncpg.Pool = Depends(get_pool)):
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
        return await _fetch_cart(conn, user["telegram_id"])
