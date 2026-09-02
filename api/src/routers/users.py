import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from src.auth.deps import get_current_user, get_init_data
from src.db.connection import get_pool
from src.schemas.user import RegisterIn, UserOut

router = APIRouter(prefix="/api", tags=["Users"])

@router.post("/register", response_model=UserOut)
async def register_user(
    payload: RegisterIn,
    init_data: dict = Depends(get_init_data),
    pool: asyncpg.Pool = Depends(get_pool)
):
    """
    Реєструє нового користувача.
    Бере telegram_id з валідованих даних Telegram, 
    а решту даних (ім'я, телефон, адреса) — з тіла запиту.
    """
    # Отримуємо telegram_id з розпарсеного словника
    telegram_id = init_data.get("user", {}).get("id")
    
    if not telegram_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не вдалося отримати telegram_id з даних авторизації"
        )

    # SQL-запит для створення користувача (з поверненням створеного рядка).
    # Використовуємо ON CONFLICT (telegram_id) DO UPDATE, щоб уникнути помилок, 
    # якщо користувач спробує "зареєструватися" повторно, оновивши свої дані.
    query = """
        INSERT INTO users (telegram_id, full_name, phone, delivery_address)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (telegram_id) DO UPDATE 
        SET full_name = EXCLUDED.full_name,
            phone = EXCLUDED.phone,
            delivery_address = EXCLUDED.delivery_address
        RETURNING id, telegram_id, full_name, phone, delivery_address
    """

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            query,
            telegram_id,
            payload.full_name,
            payload.phone,
            payload.delivery_address
        )

    return UserOut(**dict(row))


@router.get("/me", response_model=UserOut)
async def get_me(user=Depends(get_current_user)):
    """
    Повертає профіль поточного авторизованого користувача.
    Якщо користувач не зареєстрований, залежність get_current_user 
    автоматично викине помилку 404.
    """
    return UserOut(**dict(user))