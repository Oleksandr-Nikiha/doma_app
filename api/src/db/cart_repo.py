import asyncpg

async def get_or_create_cart_id(pool: asyncpg.Pool, telegram_id: int) -> int:
    """
    Повертає id кошика юзера. Якщо кошика ще нема — створює.
    Атомарний запит, стійкий до race condition (подвійних кліків).
    """
    query = """
        INSERT INTO carts (telegram_id) 
        VALUES ($1)
        ON CONFLICT (telegram_id) DO UPDATE 
        SET telegram_id = EXCLUDED.telegram_id
        RETURNING id;
    """
    
    async with pool.acquire() as conn:
        return await conn.fetchval(query, telegram_id)