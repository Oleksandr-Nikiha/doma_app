from pydantic import BaseModel, Field


class OptionSelectionIn(BaseModel):
    group_id: int
    variant_id: int

class CartItemIn(BaseModel):
    variant_id: int
    qty: int = Field(..., gt=0)
    options: list[OptionSelectionIn] = []

class CartItemUpdateIn(BaseModel):
    qty: int = Field(..., gt=0)

class CartItemOptionOut(BaseModel):
    name: str
    group_id: int
    variant_id: int
    label: str
    price_delta: float
    qty: int

class CartItemOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    variant_label: str
    weight: str | None = None
    price: float
    qty: int
    subtotal: float
    options: list[CartItemOptionOut] = []

class CartOut(BaseModel):
    items: list[CartItemOut]
    total: float