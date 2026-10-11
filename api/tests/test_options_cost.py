from dataclasses import dataclass

from src.routers.cart import build_options_key, options_cost


@dataclass
class OptionStub:
    group_id: int
    variant_id: int
    qty: int


class TestOptionsCost:
    """Тестування функції розрахунку вартості опцій з квотами (options_cost)."""

    def test_options_cost_empty_list(self):
        """Порожній список опцій дає нульову вартість."""
        assert options_cost([], 0) == 0.0
        assert options_cost([], 5) == 0.0

    def test_options_cost_no_free_quota(self):
        """Без безкоштовної квоти (free_count = 0) сплачуються всі одиниці."""
        prices = [15.0, 20.0, 25.0]
        assert options_cost(prices, 0) == 60.0

    def test_options_cost_single_free_item_most_expensive(self):
        """
        При квоті 1 найдорожча одиниця списується безкоштовно.
        Наприклад, соуси [15, 25, 10]: 25 безкоштовний, сума = 15 + 10 = 25.
        """
        prices = [15.0, 25.0, 10.0]
        assert options_cost(prices, 1) == 25.0

    def test_options_cost_multiple_free_items(self):
        """Квота 2 покриває 2 найдорожчі позиції."""
        prices = [10.0, 30.0, 20.0, 40.0]
        # Найдорожчі 40 та 30 безкоштовні, лишаються 20 та 10 -> 30.0
        assert options_cost(prices, 2) == 30.0

    def test_options_cost_quota_exceeds_or_equals_total_count(self):
        """Якщо квота рівна або більша за кількість обраних опцій, вартість = 0."""
        prices = [15.0, 25.0]
        assert options_cost(prices, 2) == 0.0
        assert options_cost(prices, 5) == 0.0

    def test_options_cost_duplicate_prices(self):
        """Однакові ціни (наприклад, 2 кетчупи по 20 грн з квотою 1)."""
        prices = [20.0, 20.0]
        assert options_cost(prices, 1) == 20.0

    def test_options_cost_float_precision_rounding(self):
        """Заокруглення до 2 знаків після коми."""
        prices = [12.333, 15.666]
        # free_count = 1: найдорожчий 15.666 списано, лишається 12.333 -> round = 12.33
        assert options_cost(prices, 1) == 12.33


class TestBuildOptionsKey:
    """Тестування детермінованого формування ключа опцій (build_options_key)."""

    def test_empty_options_key(self):
        """Порожній список опцій дає порожній рядок."""
        assert build_options_key([]) == ""

    def test_ordering_invariance(self):
        """Порядок передачі опцій не повинен впливати на кінцевий ключ."""
        opt1 = OptionStub(group_id=2, variant_id=10, qty=1)
        opt2 = OptionStub(group_id=1, variant_id=5, qty=2)

        key_a = build_options_key([opt1, opt2])
        key_b = build_options_key([opt2, opt1])

        assert key_a == "1:5:2|2:10:1"
        assert key_a == key_b

    def test_different_quantities_produce_distinct_keys(self):
        """Різна кількість тієї самої опції утворює різні ключі кошика."""
        opt_one = OptionStub(group_id=1, variant_id=5, qty=1)
        opt_two = OptionStub(group_id=1, variant_id=5, qty=2)

        assert build_options_key([opt_one]) != build_options_key([opt_two])
        assert build_options_key([opt_one]) == "1:5:1"
        assert build_options_key([opt_two]) == "1:5:2"

    def test_multiple_variants_same_group(self):
        """Декілька варіантів в одній групі сортуються за variant_id."""
        opt_v20 = OptionStub(group_id=3, variant_id=20, qty=1)
        opt_v15 = OptionStub(group_id=3, variant_id=15, qty=1)

        key = build_options_key([opt_v20, opt_v15])
        assert key == "3:15:1|3:20:1"
