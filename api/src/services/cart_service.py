import asyncpg

from src.schemas.cart import CartItemOptionOut, CartItemOut, CartOut
from src.services.cart_helpers import options_cost


async def _fetch_cart(
    conn_or_pool: asyncpg.Connection | asyncpg.Pool, telegram_id: int
) -> CartOut:
    """
    Витягує кошик разом із вибраними опціями.
    Підтримує як asyncpg.Connection, так і asyncpg.Pool для уникнення зайвих циклів acquire/release.
    """
    items_query = """
        SELECT ci.id, ci.variant_id, p.id AS product_id, p.name AS product_name,
               pv.label AS variant_label, pv.weight, pv.price, ci.qty,
               loc.id AS location_id, loc.name AS location_name
        FROM cart_items ci
        JOIN product_variants pv ON pv.id = ci.variant_id
        JOIN products p ON p.id = pv.product_id
        JOIN categories cat ON cat.id = p.category_id
        JOIN locations loc ON loc.id = cat.location_id
        JOIN carts c ON c.id = ci.cart_id
        WHERE c.telegram_id = $1
        ORDER BY ci.id
    """
    options_query = """
        SELECT cio.cart_item_id, cio.group_id, cio.variant_id, cio.qty,
               op.name, opv.label, ogi.price_delta, pog.free_count
        FROM cart_item_options cio
        JOIN option_group_items ogi
             ON ogi.group_id = cio.group_id AND ogi.variant_id = cio.variant_id
        JOIN product_variants opv ON opv.id = cio.variant_id
        JOIN products op ON op.id = opv.product_id
        JOIN cart_items ci ON ci.id = cio.cart_item_id
        JOIN product_variants cv ON cv.id = ci.variant_id
        JOIN product_option_groups pog
             ON pog.product_id = cv.product_id AND pog.group_id = cio.group_id
        WHERE cio.cart_item_id = ANY($1::int[])
        ORDER BY cio.cart_item_id, pog.sort_order, ogi.sort_order
    """

    async def _fetch_data(conn: asyncpg.Connection):
        item_rows = await conn.fetch(items_query, telegram_id)
        if not item_rows:
            return item_rows, []
        cart_item_ids = [r["id"] for r in item_rows]
        option_rows = await conn.fetch(options_query, cart_item_ids)
        return item_rows, option_rows

    if hasattr(conn_or_pool, "acquire"):
        async with conn_or_pool.acquire() as conn:
            item_rows, option_rows = await _fetch_data(conn)
    else:
        item_rows, option_rows = await _fetch_data(conn_or_pool)

    if not item_rows:
        return CartOut(items=[], total=0.0)

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
        subtotal = round(price * item["qty"] + extra, 2)
        total += subtotal

        items.append(
            CartItemOut(
                id=item["id"],
                product_id=item["product_id"],
                variant_id=item.get("variant_id"),
                product_name=item["product_name"],
                variant_label=item["variant_label"],
                weight=item["weight"],
                price=price,
                qty=item["qty"],
                subtotal=subtotal,
                location_id=item["location_id"],
                location_name=item["location_name"],
                options=options,
            )
        )

    return CartOut(items=items, total=round(total, 2))
