from src.routers.cart import _fetch_cart


class TestCartFetch:
    """Тестування внутрішньої функції _fetch_cart та розрахунку кошика."""

    async def test_fetch_cart_empty(self, mock_db_conn):
        mock_db_conn.fetch.side_effect = [
            [],  # items_query -> немає товарів
        ]
        cart = await _fetch_cart(mock_db_conn, telegram_id=123)
        assert cart.items == []
        assert cart.total == 0.0

    async def test_fetch_cart_with_items_and_options(self, mock_db_conn):
        item_row = {
            "id": 10,
            "product_id": 100,
            "product_name": "Піца Маргарита",
            "variant_label": "30 см",
            "weight": "450г",
            "price": 200.0,
            "qty": 2,
            "location_id": 1,
            "location_name": "Doma Pizza",
        }
        option_row = {
            "cart_item_id": 10,
            "group_id": 1,
            "variant_id": 50,
            "qty": 2,
            "name": "Сирний соус",
            "label": "50г",
            "price_delta": 25.0,
            "free_count": 1,  # 1 безкоштовний на піцу * 2 піци = 2 безкоштовних
        }

        mock_db_conn.fetch.side_effect = [
            [item_row],  # items_query
            [option_row],  # options_query
        ]

        cart = await _fetch_cart(mock_db_conn, telegram_id=123)
        assert len(cart.items) == 1
        item = cart.items[0]
        assert item.product_name == "Піца Маргарита"
        assert item.qty == 2
        # Базова ціна: 200 * 2 = 400.
        # Опції: 2 соуси по 25, free_count 1 * 2 = 2 безкоштовних -> вартість опцій 0
        # Разом: 400.0
        assert item.subtotal == 400.0
        assert cart.total == 400.0


class TestCartApiEndpoints:
    """Тестування REST API роутера /api/cart."""

    async def test_get_cart_endpoint(self, async_client, mock_db_conn):
        mock_db_conn.fetch.side_effect = [[], []]
        response = await async_client.get("/api/cart")
        assert response.status_code == 200
        assert response.json() == {"items": [], "total": 0.0}

    async def test_add_item_duplicate_options_raises_400(self, async_client):
        payload = {
            "variant_id": 1,
            "qty": 1,
            "options": [
                {"group_id": 1, "variant_id": 10, "qty": 1},
                {"group_id": 1, "variant_id": 10, "qty": 1},  # Дублікат пари (group, variant)
            ],
        }
        response = await async_client.post("/api/cart/items", json=payload)
        assert response.status_code == 400
        assert "Дублювання опцій" in response.json()["detail"]

    async def test_add_item_variant_not_found_raises_404(self, async_client, mock_db_conn):
        mock_db_conn.fetchrow.return_value = None  # Варіант не знайдено
        payload = {"variant_id": 999, "qty": 1, "options": []}

        response = await async_client.post("/api/cart/items", json=payload)
        assert response.status_code == 404
        assert "Варіант не знайдено" in response.json()["detail"]

    async def test_add_item_unavailable_variant_raises_409(self, async_client, mock_db_conn):
        # Товар у стоп-листі
        mock_db_conn.fetchrow.return_value = {
            "product_id": 10,
            "p_avail": True,
            "pv_avail": False,
        }
        payload = {"variant_id": 5, "qty": 1, "options": []}

        response = await async_client.post("/api/cart/items", json=payload)
        assert response.status_code == 409
        assert "Товар або варіант недоступний" in response.json()["detail"]

    async def test_add_item_foreign_group_raises_400(self, async_client, mock_db_conn):
        mock_db_conn.fetchrow.return_value = {
            "product_id": 10,
            "p_avail": True,
            "pv_avail": True,
        }
        mock_db_conn.fetch.return_value = []  # У товару немає жодної групи опцій
        payload = {
            "variant_id": 5,
            "qty": 1,
            "options": [{"group_id": 99, "variant_id": 1, "qty": 1}],
        }

        response = await async_client.post("/api/cart/items", json=payload)
        assert response.status_code == 400
        assert "Група 99 не належить товару" in response.json()["detail"]

    async def test_add_item_violates_min_max_rules_raises_400(self, async_client, mock_db_conn):
        mock_db_conn.fetchrow.return_value = {
            "product_id": 10,
            "p_avail": True,
            "pv_avail": True,
        }
        # Група вимагає обрати рівно 1 опцію (min=1, max=1)
        mock_db_conn.fetch.return_value = [{"group_id": 1, "min_select": 1, "max_select": 1}]
        # Користувач не вибрав жодної
        payload = {"variant_id": 5, "qty": 1, "options": []}

        response = await async_client.post("/api/cart/items", json=payload)
        assert response.status_code == 400
        assert "Група 1: вибрано 0" in response.json()["detail"]

    async def test_add_item_success(self, async_client, mock_db_conn):
        mock_db_conn.fetchrow.side_effect = [
            # 1. Перевірка варіанту
            {"product_id": 10, "p_avail": True, "pv_avail": True},
            # 2. upsert cart_items
            {"id": 1, "is_insert": True},
        ]
        # get_or_create_cart_id повертає 100, перевірка existing_qty повертає None
        mock_db_conn.fetchval.side_effect = [100, None]
        # groups -> empty, _fetch_cart -> empty
        mock_db_conn.fetch.side_effect = [
            [],  # product_option_groups
            [],  # _fetch_cart items
        ]

        payload = {"variant_id": 5, "qty": 1, "options": []}
        response = await async_client.post("/api/cart/items", json=payload)
        assert response.status_code == 200

    async def test_add_item_qty_over_limit_raises_422(self, async_client):
        # Захист SEC-01: qty > 50 відхиляється валідатором схеми
        payload = {"variant_id": 5, "qty": 51, "options": []}
        response = await async_client.post("/api/cart/items", json=payload)
        assert response.status_code == 422

    async def test_update_item_not_found_raises_404(self, async_client, mock_db_conn):
        mock_db_conn.fetchrow.return_value = None  # Позицію не знайдено
        response = await async_client.patch("/api/cart/items/99", json={"qty": 2})
        assert response.status_code == 404
        assert "Товар не знайдено в кошику" in response.json()["detail"]

    async def test_update_item_unsymmetric_options_raises_409(self, async_client, mock_db_conn):
        # Позиція в кошику: qty = 2, product_id = 1
        mock_db_conn.fetchrow.return_value = {
            "id": 10,
            "cart_id": 5,
            "qty": 2,
            "variant_id": 1,
            "product_id": 1,
        }
        # Правила групи: min 0, max 2
        mock_db_conn.fetch.side_effect = [
            [{"group_id": 1, "min_select": 0, "max_select": 2}],
            # Обрано 1 соус на 2 піци (не ділиться націло на old_qty=2)
            [{"group_id": 1, "variant_id": 5, "qty": 1}],
        ]

        response = await async_client.patch("/api/cart/items/10", json={"qty": 3})
        assert response.status_code == 409
        assert "Опції вибрано несиметрично" in response.json()["detail"]

    async def test_delete_cart_item_not_found_raises_404(self, async_client, mock_db_conn):
        mock_db_conn.execute.return_value = "DELETE 0"
        response = await async_client.delete("/api/cart/items/999")
        assert response.status_code == 404
        assert "Товар не знайдено в кошику" in response.json()["detail"]

    async def test_delete_cart_item_success(self, async_client, mock_db_conn):
        mock_db_conn.execute.return_value = "DELETE 1"
        mock_db_conn.fetch.side_effect = [[], []]  # _fetch_cart returns empty
        response = await async_client.delete("/api/cart/items/10")
        assert response.status_code == 200
        assert response.json() == {"items": [], "total": 0.0}

    async def test_clear_cart_success(self, async_client, mock_db_conn):
        mock_db_conn.execute.return_value = "DELETE 3"
        mock_db_conn.fetch.side_effect = [[], []]  # _fetch_cart returns empty
        response = await async_client.delete("/api/cart")
        assert response.status_code == 200
        assert response.json() == {"items": [], "total": 0.0}
