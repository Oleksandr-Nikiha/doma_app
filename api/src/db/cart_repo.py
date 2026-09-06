import asyncpg


async def get_or_create_cart_id(conn: asyncpg.Connection, telegram_id: int) -> int:
    """
    Повертає id кошика юзера. Якщо кошика ще нема — створює.

    Приймає зʼєднання, а не пул: виклик іде всередині транзакції додавання
    позиції, і власне зʼєднання з пулу опинилося б поза нею — кошик створився
    б навіть тоді, коли решта операції відкотилась.

    ON CONFLICT ... DO UPDATE SET telegram_id = EXCLUDED.telegram_id — трюк,
    що завжди повертає рядок. З DO NOTHING RETURNING віддав би порожньо,
    якщо кошик уже існує, і два швидкі кліки дали б None.
    """
    query = """
        INSERT INTO carts (telegram_id)
        VALUES ($1)
        ON CONFLICT (telegram_id) DO UPDATE
        SET telegram_id = EXCLUDED.telegram_id
        RETURNING id;
    """
    return await conn.fetchval(query, telegram_id)
