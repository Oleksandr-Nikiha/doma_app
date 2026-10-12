import hashlib
import hmac
import time
from typing import Any


def validate_telegram_widget_data(
    data: dict[str, Any],
    bot_token: str,
    max_age_seconds: int = 86400,
) -> dict[str, Any]:
    """
    Валідує дані авторизації від офіційного Telegram Login Widget (core.telegram.org/widgets/login).
    Повертає словник перевірених даних або піднімає ValueError
    при невідповідності підпису або застарілості.
    """
    data_copy = {k: v for k, v in data.items() if v is not None and v != ""}

    if "hash" not in data_copy:
        raise ValueError("Відсутній параметр 'hash' у даних")

    received_hash = str(data_copy.pop("hash"))

    # Формуємо data_check_string: рядки key=val, відсортовані за алфавітом, розділені '\n'
    check_pairs = [f"{k}={data_copy[k]}" for k in sorted(data_copy.keys())]
    data_check_string = "\n".join(check_pairs)

    # Відповідно до специфікації Telegram: secret_key = SHA256(bot_token)
    secret_key = hashlib.sha256(bot_token.encode("utf-8")).digest()

    calculated_hash = hmac.new(
        key=secret_key,
        msg=data_check_string.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(calculated_hash, received_hash):
        raise ValueError("Невалідний підпис: hash не співпадає")

    if "auth_date" in data_copy:
        try:
            auth_date = int(data_copy["auth_date"])
            if abs(time.time() - auth_date) > max_age_seconds:
                raise ValueError(f"Дані авторизації застаріли (вік перевищує {max_age_seconds} с)")
        except ValueError as e:
            raise ValueError(f"Невалідний auth_date: {e}") from e

    return data_copy
