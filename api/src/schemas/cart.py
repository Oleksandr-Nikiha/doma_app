from pydantic import BaseModel, Field

class CartItemIn(BaseModel):
    variant_id: int
    qty: int = Field(..., gt=0)

class CartItemUpdateIn(BaseModel):
    qty: int = Field(..., gt=0)

class CartItemOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    variant_label: str
    weight: str | None = None
    price: float
    qty: int
    subtotal: float

class CartOut(BaseModel):
    items: list[CartItemOut]
    total: float