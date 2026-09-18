from datetime import datetime
from pydantic import BaseModel, Field


class DeliveryAddressOut(BaseModel):
    """Публічна інформація про доступну вулицю доставки для клієнтів."""

    id: int
    city: str
    street: str


class AdminDeliveryAddressOut(BaseModel):
    """Повна інформація про адресу для адмін-панелі (включаючи статус стоплиста)."""

    id: int
    city: str
    street: str
    is_active: bool
    notes: str | None = None
    sort_order: int = 0
    created_at: datetime
    updated_at: datetime


class DeliveryAddressCreateIn(BaseModel):
    """Створення нової адреси в довіднику."""

    city: str = Field(default="Вишгород", min_length=1, max_length=100)
    street: str = Field(..., min_length=1, max_length=255)
    is_active: bool = True
    notes: str | None = Field(default=None, max_length=500)
    sort_order: int = 0


class DeliveryAddressUpdateIn(BaseModel):
    """Редагування адреси в довіднику (включаючи перемикання стоплиста)."""

    city: str | None = Field(default=None, min_length=1, max_length=100)
    street: str | None = Field(default=None, min_length=1, max_length=255)
    is_active: bool | None = None
    notes: str | None = Field(default=None, max_length=500)
    sort_order: int | None = None

