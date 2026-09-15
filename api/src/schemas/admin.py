from typing import Literal
from pydantic import BaseModel, Field


# --- Права поточного користувача ---

class AdminMeOut(BaseModel):
    is_staff: bool
    role: Literal["admin", "manager"] | None = None
    location_id: int | None = None
    location_name: str | None = None


# --- Менеджери (Штат) ---

class ManagerCreateIn(BaseModel):
    telegram_id: int
    role: Literal["admin", "manager"] = "manager"
    location_id: int | None = None


class ManagerUpdateIn(BaseModel):
    role: Literal["admin", "manager"] | None = None
    location_id: int | None = None
    is_active: bool | None = None


class ManagerOut(BaseModel):
    id: int
    telegram_id: int
    full_name: str
    phone: str
    role: str
    location_id: int | None = None
    location_name: str | None = None
    is_active: bool


# --- Категорії ---

class CategoryCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    location_id: int
    parent_id: int | None = None
    icon: str | None = None
    sort_order: int = 0
    is_visible: bool = True


class CategoryUpdateIn(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    location_id: int | None = None
    parent_id: int | None = None
    icon: str | None = None
    sort_order: int | None = None
    is_visible: bool | None = None


# --- Варіанти страв (Розміри / ціни) ---

class VariantCreateIn(BaseModel):
    label: str = Field(..., min_length=1, max_length=50)
    price: float = Field(..., ge=0)
    weight: str | None = None
    sort_order: int = 0
    is_available: bool = True


class VariantUpdateIn(BaseModel):
    label: str | None = Field(None, min_length=1, max_length=50)
    price: float | None = Field(None, ge=0)
    weight: str | None = None
    sort_order: int | None = None
    is_available: bool | None = None


# --- Страви (Товари) ---

class ProductCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    category_id: int
    description: str | None = None
    image_url: str | None = None
    sort_order: int = 0
    is_available: bool = True
    variants: list[VariantCreateIn] = []


class ProductUpdateIn(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=150)
    category_id: int | None = None
    description: str | None = None
    image_url: str | None = None
    sort_order: int | None = None
    is_available: bool | None = None


# --- Швидкий стоп-лист ---

class AvailabilityUpdateIn(BaseModel):
    is_available: bool
    

# --- Додатки (Модифікатори та групи опцій) ---

class OptionGroupCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    sort_order: int = 0


class OptionGroupUpdateIn(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    sort_order: int | None = None


class OptionGroupItemCreateIn(BaseModel):
    variant_id: int
    price_delta: float = 0.0
    sort_order: int = 0
    is_available: bool = True


class OptionGroupItemUpdateIn(BaseModel):
    price_delta: float | None = None
    sort_order: int | None = None
    is_available: bool | None = None


class ProductOptionGroupAttachIn(BaseModel):
    group_id: int
    min_select: int = 1
    max_select: int = 1
    free_count: int = 0
    sort_order: int = 0


class ProductOptionGroupUpdateIn(BaseModel):
    min_select: int | None = None
    max_select: int | None = None
    free_count: int | None = None
    sort_order: int | None = None


# --- Моделі відповідей для адмінки ---

class VariantAdminOut(BaseModel):
    id: int
    product_id: int
    label: str
    price: float
    weight: str | None = None
    sort_order: int
    is_available: bool


class ProductOptionGroupAdminOut(BaseModel):
    product_id: int
    group_id: int
    group_name: str
    min_select: int
    max_select: int
    free_count: int
    sort_order: int


class ProductAdminOut(BaseModel):
    id: int
    name: str
    category_id: int
    category_name: str | None = None
    location_id: int | None = None
    location_name: str | None = None
    description: str | None = None
    image_url: str | None = None
    sort_order: int
    is_available: bool
    variants: list[VariantAdminOut] = []
    option_groups: list[ProductOptionGroupAdminOut] = []


class CategoryAdminOut(BaseModel):
    id: int
    name: str
    location_id: int
    location_name: str | None = None
    parent_id: int | None = None
    icon: str | None = None
    sort_order: int
    is_visible: bool
    products_count: int = 0


class OptionGroupAdminOut(BaseModel):
    id: int
    name: str
    sort_order: int
    items_count: int = 0
    products_count: int = 0


class OptionGroupItemAdminOut(BaseModel):
    group_id: int
    variant_id: int
    product_id: int
    product_name: str
    variant_label: str
    price_delta: float
    sort_order: int
    is_available: bool


class VariantSelectorOut(BaseModel):
    variant_id: int
    product_id: int
    product_name: str
    variant_label: str
    price: float
    category_name: str | None = None