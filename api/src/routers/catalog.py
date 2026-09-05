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
        SELECT c.id, c.name, c.icon, c.parent_id, c.location_id, l.name AS location_name
        FROM categories c
        JOIN locations l ON l.id = c.location_id
        WHERE c.is_visible = true
        ORDER BY c.location_id,
            COALESCE(c.parent_id, c.id),
            c.parent_id NULLS FIRST,
            c.sort_order
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
            MIN(v.price) AS price_from,
            p.category_id,
            c.name AS category_name
        FROM products p
        JOIN product_variants v ON v.product_id = p.id
        JOIN categories c ON c.id = p.category_id
        WHERE p.is_available
            AND c.is_visible
            AND v.is_available
            AND (p.category_id = $1
            OR p.category_id IN (SELECT id FROM categories WHERE parent_id = $1))
        GROUP BY p.id, c.name
        ORDER BY p.sort_order
        """,
        category_id,
    )
    return [ProductListItemOut(**dict(row)) for row in rows]


@router.get("/products/{product_id}", response_model=ProductDetailOut)
async def get_product(product_id: int, pool: asyncpg.Pool = Depends(get_pool)):
    product_row = await pool.fetchrow(
        """
        SELECT p.id, p.name, p.description, p.image_url 
        FROM products p
        JOIN categories c ON c.id = p.category_id
        LEFT JOIN categories parent ON parent.id = c.parent_id
        WHERE p.id = $1 
          AND p.is_available = true 
          AND c.is_visible = true
          AND (parent.id IS NULL OR parent.is_visible = true)
        """,
        product_id,
    )
    if product_row is None:
        raise HTTPException(status_code=404, detail="Товар не знайдено або він недоступний")
    
    variant_rows = await pool.fetch(
        """
        SELECT id, label, weight, price 
        FROM product_variants 
        WHERE product_id = $1 AND is_available = true
        ORDER BY sort_order
        """,
        product_id,
    )

    option_rows = await pool.fetch(
        """
        SELECT g.id AS group_id, g.name AS group_name, pog.min_select, pog.max_select,
               ogi.variant_id, ogi.price_delta, op.name
        FROM product_option_groups pog
        JOIN option_groups g ON g.id = pog.group_id
        JOIN option_group_items ogi ON ogi.group_id = g.id
        JOIN product_variants v ON v.id = ogi.variant_id
        JOIN products op ON op.id = v.product_id
        WHERE pog.product_id = $1
          AND ogi.is_available = true 
          AND v.is_available = true
          AND op.is_available = true
        ORDER BY pog.sort_order, ogi.sort_order
        """,
        product_id,
    )

    groups_dict = {}
    for row in option_rows:
        g_id = row["group_id"]
        if g_id not in groups_dict:
            groups_dict[g_id] = {
                "group_id": g_id,
                "name": row["group_name"],
                "min_select": row["min_select"],
                "max_select": row["max_select"],
                "items": []
            }
        
        groups_dict[g_id]["items"].append({
            "variant_id": row["variant_id"],
            "name": row["name"],
            "price_delta": row["price_delta"]
        })

    return ProductDetailOut(
        **dict(product_row),
        variants=[ProductVariantOut(**dict(v)) for v in variant_rows],
        option_groups=list(groups_dict.values())
    )