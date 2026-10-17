def options_cost(unit_prices: list[float], free_count: int) -> float:
    """
    Вартість опцій однієї групи з урахуванням безкоштовної квоти.

    Кожна обрана порція — окрема одиниця, тож два кетчупи це [20, 20].
    Безкоштовними йдуть НАЙДОРОЖЧІ одиниці: клієнту вигідніше, а порядок
    визначений — інакше бекенд і фронт порахували б різні суми на групі,
    де позиції коштують по-різному.
    """
    chargeable = sorted(unit_prices, reverse=True)[free_count:]
    return round(sum(chargeable), 2)


def build_options_key(options, item_qty: int = 1) -> str:
    """
    Відбиток вибору опцій для унікального ключа позиції кошика.
    Нормалізується на одиницю страви (unit_qty = option.qty // item_qty), щоб:
    - 1 страва з 1 соусом мала такий самий options_key, як і 2 страви з 2 соусами.
    - При зміні кількості страв (+ / -) у кошику options_key залишався стабільним.
    - Запобігти появі дублікатів однакових позицій у кошику (SEC-08).
    """
    if not options:
        return ""

    def _get(obj, key):
        return getattr(obj, key) if hasattr(obj, key) else obj[key]

    ordered = sorted(options, key=lambda o: (_get(o, "group_id"), _get(o, "variant_id")))
    safe_item_qty = max(1, item_qty)
    parts = []
    for o in ordered:
        gid = _get(o, "group_id")
        vid = _get(o, "variant_id")
        qty = _get(o, "qty")
        unit_qty = (qty // safe_item_qty) if (qty % safe_item_qty == 0) else qty
        parts.append(f"{gid}:{vid}:{unit_qty}")
    return "|".join(parts)
