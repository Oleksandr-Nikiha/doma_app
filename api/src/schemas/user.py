from pydantic import BaseModel


class RegisterIn(BaseModel):
    full_name: str
    phone: str
    delivery_address: str | None = None

class UserOut(BaseModel):
    id: int
    telegram_id: int
    full_name: str
    phone: str
    delivery_address: str | None = None