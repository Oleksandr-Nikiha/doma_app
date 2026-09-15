from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class OrderCreateIn(BaseModel):
    fulfillment_type: Literal["delivery", "pickup"]
    location_id: int | None = None
    delivery_address: str | None = None
    contact_name: str = Field(..., min_length=1, max_length=100)
    contact_phone: str = Field(..., min_length=5, max_length=30)
    payment_method: Literal["cash", "card"]
    comment: str | None = Field(None, max_length=500)

    @model_validator(mode="after")
    def validate_fulfillment(self) -> "OrderCreateIn":
        if self.fulfillment_type == "delivery":
            if not self.delivery_address or not self.delivery_address.strip():
                raise ValueError("Адреса доставки обов'язкова для кур'єрської доставки")
        elif self.fulfillment_type == "pickup" and not self.location_id:
            raise ValueError("Локація обов'язкова для самовивозу")
        return self


class OrderItemOptionOut(BaseModel):
    id: int
    option_group_name: str
    option_name: str
    price_delta: float
    qty: int


class OrderItemOut(BaseModel):
    id: int
    variant_id: int | None
    product_name: str
    variant_label: str
    unit_price: float
    qty: int
    subtotal: float
    options: list[OrderItemOptionOut] = []


class OrderGroupOut(BaseModel):
    id: int
    location_id: int
    location_name: str
    status: str
    subtotal: float
    items: list[OrderItemOut] = []


class OrderOut(BaseModel):
    id: int
    telegram_id: int
    status: str
    fulfillment_type: str
    delivery_address: str | None = None
    contact_name: str
    contact_phone: str
    payment_method: str
    comment: str | None = None
    total_price: float
    created_at: datetime
    groups: list[OrderGroupOut] = []

