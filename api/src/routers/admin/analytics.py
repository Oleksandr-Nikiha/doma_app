import asyncpg
from fastapi import APIRouter, Depends, Query

from src.auth.deps import get_current_admin
from src.db.connection import get_pool
from src.schemas.admin import (
    AnalyticsDynamicsPoint,
    AnalyticsFulfillmentBreakdown,
    AnalyticsKPI,
    AnalyticsLocationBreakdown,
    AnalyticsPaymentBreakdown,
    AnalyticsStatusBreakdown,
    AnalyticsSummaryOut,
    AnalyticsTopProductOut,
)

router = APIRouter()


def _get_period_clause(period: str, prefix: str = "") -> str:
    col = f"{prefix}.created_at" if prefix else "created_at"
    clauses = {
        "today": f"{col} >= date_trunc('day', now() AT TIME ZONE 'Europe/Kyiv')",
        "7d": f"{col} >= now() - INTERVAL '7 days'",
        "30d": f"{col} >= now() - INTERVAL '30 days'",
    }
    return clauses.get(period, "1=1")


@router.get("/analytics/summary", response_model=AnalyticsSummaryOut)
async def get_analytics_summary(
    period: str = Query("7d", pattern="^(today|7d|30d|all)$"),
    location_id: int | None = Query(None),
    admin: asyncpg.Record = Depends(get_current_admin),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Повертає зведені показники (KPI, динаміку по днях та розбивки).
    """
    target_location_id = location_id

    period_sql = _get_period_clause(period)

    # Базова умова для фільтрації orders
    where_parts = [period_sql]
    params: list = []

    if target_location_id:
        params.append(target_location_id)
        where_parts.append(
            f"id IN (SELECT order_id FROM order_groups WHERE location_id = ${len(params)})"
        )

    where_clause = " AND ".join(where_parts)

    async with pool.acquire() as conn:
        # 1. Загальні KPI (тільки непомилкові замовлення)
        kpi_row = await conn.fetchrow(
            f"""
            SELECT
                COALESCE(COUNT(*), 0) AS orders_count,
                COALESCE(SUM(total_price), 0) AS revenue,
                COALESCE(COUNT(DISTINCT telegram_id), 0) AS customers_count
            FROM orders
            WHERE {where_clause} AND status NOT IN ('rejected', 'cancelled')
            """,
            *params,
        )

        orders_count = int(kpi_row["orders_count"])
        revenue = float(kpi_row["revenue"])
        customers_count = int(kpi_row["customers_count"])
        avg_order_value = round(revenue / orders_count, 2) if orders_count > 0 else 0.0

        kpi = AnalyticsKPI(
            revenue=revenue,
            orders_count=orders_count,
            avg_order_value=avg_order_value,
            customers_count=customers_count,
        )

        # 2. Розбивка за статусами
        status_rows = await conn.fetch(
            f"""
            SELECT status, COUNT(*) AS count, COALESCE(SUM(total_price), 0) AS total_amount
            FROM orders
            WHERE {where_clause}
            GROUP BY status
            ORDER BY count DESC
            """,
            *params,
        )
        by_status = [
            AnalyticsStatusBreakdown(
                status=r["status"],
                count=int(r["count"]),
                total_amount=float(r["total_amount"]),
            )
            for r in status_rows
        ]

        # 3. Розбивка за способом отримання (fulfillment_type)
        fulfillment_rows = await conn.fetch(
            f"""
            SELECT fulfillment_type, COUNT(*) AS count,
                   COALESCE(SUM(total_price), 0) AS total_amount
            FROM orders
            WHERE {where_clause} AND status NOT IN ('rejected', 'cancelled')
            GROUP BY fulfillment_type
            ORDER BY count DESC
            """,
            *params,
        )
        by_fulfillment = [
            AnalyticsFulfillmentBreakdown(
                fulfillment_type=r["fulfillment_type"],
                count=int(r["count"]),
                total_amount=float(r["total_amount"]),
            )
            for r in fulfillment_rows
        ]

        # 4. Розбивка за способом оплати (payment_method)
        payment_rows = await conn.fetch(
            f"""
            SELECT payment_method, COUNT(*) AS count, COALESCE(SUM(total_price), 0) AS total_amount
            FROM orders
            WHERE {where_clause} AND status NOT IN ('rejected', 'cancelled')
            GROUP BY payment_method
            ORDER BY count DESC
            """,
            *params,
        )
        by_payment = [
            AnalyticsPaymentBreakdown(
                payment_method=r["payment_method"],
                count=int(r["count"]),
                total_amount=float(r["total_amount"]),
            )
            for r in payment_rows
        ]

        # 5. Розбивка за закладами (локаціями)
        loc_period_sql = _get_period_clause(period, prefix="o")
        loc_where = [loc_period_sql, "o.status NOT IN ('rejected', 'cancelled')"]
        loc_params: list = []
        if target_location_id:
            loc_params.append(target_location_id)
            loc_where.append(f"l.id = ${len(loc_params)}")

        loc_sql = f"""
            SELECT
                l.id AS location_id,
                l.name AS location_name,
                COUNT(DISTINCT og.order_id) AS orders_count,
                COALESCE(SUM(og.subtotal), 0) AS revenue
            FROM locations l
            LEFT JOIN order_groups og ON og.location_id = l.id
            LEFT JOIN orders o ON o.id = og.order_id AND {" AND ".join(loc_where)}
            {"WHERE l.id = $1" if target_location_id else ""}
            GROUP BY l.id, l.name
            ORDER BY l.id
        """
        location_rows = await conn.fetch(loc_sql, *loc_params)
        by_location = [
            AnalyticsLocationBreakdown(
                location_id=r["location_id"],
                location_name=r["location_name"],
                orders_count=int(r["orders_count"]),
                revenue=float(r["revenue"]),
            )
            for r in location_rows
        ]

        # 6. Динаміка замовлень за днями
        dynamics_rows = await conn.fetch(
            f"""
            SELECT
                to_char(created_at AT TIME ZONE 'Europe/Kyiv', 'YYYY-MM-DD') AS day,
                COUNT(*) AS orders_count,
                COALESCE(SUM(total_price), 0) AS revenue
            FROM orders
            WHERE {where_clause} AND status NOT IN ('rejected', 'cancelled')
            GROUP BY day
            ORDER BY day ASC
            """,
            *params,
        )
        dynamics = [
            AnalyticsDynamicsPoint(
                date=r["day"],
                orders_count=int(r["orders_count"]),
                revenue=float(r["revenue"]),
            )
            for r in dynamics_rows
        ]

    return AnalyticsSummaryOut(
        period=period,
        kpi=kpi,
        by_status=by_status,
        by_fulfillment=by_fulfillment,
        by_payment=by_payment,
        by_location=by_location,
        dynamics=dynamics,
    )


@router.get("/analytics/top-products", response_model=list[AnalyticsTopProductOut])
async def get_analytics_top_products(
    period: str = Query("7d", pattern="^(today|7d|30d|all)$"),
    limit: int = Query(10, ge=1, le=50),
    location_id: int | None = Query(None),
    admin: asyncpg.Record = Depends(get_current_admin),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Повертає найпопулярніші страви (топ) за вибраний період.
    """
    target_location_id = location_id
    period_sql = _get_period_clause(period, prefix="o")

    where_parts = [
        period_sql,
        "o.status NOT IN ('rejected', 'cancelled')",
    ]
    params: list = []

    if target_location_id:
        params.append(target_location_id)
        where_parts.append(f"og.location_id = ${len(params)}")

    params.append(limit)
    limit_placeholder = f"${len(params)}"

    where_clause = " AND ".join(where_parts)

    query = f"""
        SELECT
            oi.product_name,
            oi.variant_label,
            COALESCE(SUM(oi.qty), 0) AS total_qty,
            COALESCE(SUM(oi.subtotal), 0) AS total_revenue
        FROM order_items oi
        JOIN order_groups og ON og.id = oi.order_group_id
        JOIN orders o ON o.id = og.order_id
        WHERE {where_clause}
        GROUP BY oi.product_name, oi.variant_label
        ORDER BY total_qty DESC, total_revenue DESC
        LIMIT {limit_placeholder}
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)

    return [
        AnalyticsTopProductOut(
            product_name=r["product_name"],
            variant_label=r["variant_label"],
            total_qty=int(r["total_qty"]),
            total_revenue=float(r["total_revenue"]),
        )
        for r in rows
    ]
