from pydantic import BaseModel


class CategoryOut(BaseModel):
    id: int
    name: str
    icon: str | None = None
    location_id: int
    location_name: str


class ProductVariantOut(BaseModel):
    id: int
    label: str
    weight: str | None = None
    price: float


class ProductListItemOut(BaseModel):
    """Скорочена картка товару для списку категорії — без повного опису."""
    id: int
    name: str
    image_url: str | None = None
    price_from: float


class ProductDetailOut(BaseModel):
    """Повна картка товару — з описом і усіма варіантами розмірів/цін."""
    id: int
    name: str
    description: str | None = None
    image_url: str | None = None
    variants: list[ProductVariantOut]