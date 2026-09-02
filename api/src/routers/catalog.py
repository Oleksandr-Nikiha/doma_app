import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from src.db.connection import get_pool
from src.schemas.catalog import (
    CategoryOut,
    ProductDetailOut,
    ProductListItemOut,
    ProductVariantOut,
)

router = APIRouter(prefix="/api", tags=["catalog"])


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(pool: asyncpg.Pool = Depends(get_pool)):
    rows = await pool.fetch(
        """
        SELECT c.id, c.name, c.icon, c.location_id, l.name AS location_name
        FROM categories c
        JOIN locations l ON l.id = c.location_id
        ORDER BY c.location_id, c.sort_order
        """
    )
    return [CategoryOut(**dict(row)) for row in rows]


@router.get("/categories/{category_id}/products", response_model=list[ProductListItemOut])
async def list_products_by_category(category_id: int, pool: asyncpg.Pool = Depends(get_pool)):
    rows = await pool.fetch(
        """
        SELECT
            p.id,
            p.name,
            p.image_url,
            MIN(v.price) AS price_from
        FROM products p
        JOIN product_variants v ON v.product_id = p.id
        WHERE p.category_id = $1
        GROUP BY p.id, p.name, p.image_url, p.sort_order
        ORDER BY p.sort_order
        """,
        category_id,
    )
    if not rows:
        # Порожній список — не обов'язково помилка (категорія може бути ще без товарів),
        # тож 200 з [] є доречнішим за 404 тут.
        return []
    return [ProductListItemOut(**dict(row)) for row in rows]


@router.get("/products/{product_id}", response_model=ProductDetailOut)
async def get_product(product_id: int, pool: asyncpg.Pool = Depends(get_pool)):
    product_row = await pool.fetchrow(
        "SELECT id, name, description, image_url FROM products WHERE id = $1",
        product_id,
    )
    if product_row is None:
        raise HTTPException(status_code=404, detail="Товар не знайдено")

    variant_rows = await pool.fetch(
        """
        SELECT id, label, weight, price
        FROM product_variants
        WHERE product_id = $1
        ORDER BY sort_order
        """,
        product_id,
    )

    return ProductDetailOut(
        **dict(product_row),
        variants=[ProductVariantOut(**dict(v)) for v in variant_rows],
    )