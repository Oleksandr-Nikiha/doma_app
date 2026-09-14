from pydantic import BaseModel


class RegisterIn(BaseModel):
    full_name: str
    phone: str
    delivery_address: str | None = None
    first_name: str | None = None
    last_name: str | None = None


class UserUpdateIn(BaseModel):
    first_name: str
    last_name: str | None = None
    delivery_address: str | None = None
    additional_address: str | None = None


class UserOut(BaseModel):
    id: int
    telegram_id: int
    full_name: str
    first_name: str | None = None
    last_name: str | None = None
    phone: str
    delivery_address: str | None = None
    additional_address: str | None = None
    client_code: str | None = None
    bonus_balance: int = 0