"""
Генерує валідний тестовий рядок initData, підписаний реальним BOT_TOKEN —
той самий алгоритм, який використовує сам Telegram при відкритті Mini App.

Використання:
    BOT_TOKEN=123456:ABC-your-token python3 scripts/generate_test_init_data.py

Або передати токен прямо як аргумент:
    python3 scripts/generate_test_init_data.py 123456:ABC-your-token

Виводить готовий рядок, який можна вставити як значення заголовка
X-Telegram-Init-Data у Swagger (/docs) або curl.

УВАГА: це лише dev-інструмент для локального тестування, не запускати в проді
і не комітити реальний BOT_TOKEN у git (використовуй .env / змінні оточення).
"""

import hashlib
import hmac
import json
import os
import sys
import time
import urllib.parse

# Фейковий telegram-юзер для тестів — підстав свій реальний telegram_id,
# якщо хочеш потім бачити себе в pgAdmin після /register
FAKE_USER = {
    "id": 111111111,
    "first_name": "Test",
    "last_name": "User",
    "username": "test_user",
    "language_code": "uk",
}


def build_test_init_data(bot_token: str) -> str:
    auth_date = str(int(time.time()))
    user_json = json.dumps(FAKE_USER, separators=(",", ":"), ensure_ascii=False)

    # Поля, які реально присутні у справжньому initData (без hash)
    fields = {
        "user": user_json,
        "auth_date": auth_date,
        "query_id": "AAHtestquery1234",
    }

    # Крок 1: data_check_string — той самий формат, що і при валідації
    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(fields.items())
    )

    # Крок 2: той самий HMAC-ланцюжок, що і на бекенді
    secret_key = hmac.new(
        key=b"WebAppData",
        msg=bot_token.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).digest()
    computed_hash = hmac.new(
        key=secret_key,
        msg=data_check_string.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()

    fields["hash"] = computed_hash

    # Крок 3: зібрати фінальний initData як справжній query-string
    # (значення обов'язково url-encoded, як у реальному Telegram)
    return urllib.parse.urlencode(fields)


if __name__ == "__main__":
    token = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("BOT_TOKEN")
    if not token:
        print("Помилка: передай BOT_TOKEN аргументом або через змінну оточення BOT_TOKEN")
        sys.exit(1)

    init_data = build_test_init_data(token)
    print("\nГотовий тестовий initData (встав як значення заголовка X-Telegram-Init-Data):\n")
    print(init_data)
    print()