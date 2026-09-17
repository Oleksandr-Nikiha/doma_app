import hashlib
import hmac
import time


def create_admin_token(telegram_id: int, secret_key: str, days: int = 30) -> str:
    """
    Генерує підписаний токен адміністратора на основі HMAC-SHA256.
    Формат: v1.{telegram_id}.{expires_timestamp}.{signature}
    """
    expires_at = int(time.time()) + (days * 86400)
    payload = f"{telegram_id}:{expires_at}"
    signature = hmac.new(
        secret_key.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"v1.{telegram_id}.{expires_at}.{signature}"


def verify_admin_token(token: str, secret_key: str) -> int | None:
    """
    Перевіряє підпис і строк дії токена.
    Повертає telegram_id, якщо токен валідний, або None.
    """
    try:
        parts = token.split(".")
        if len(parts) != 4 or parts[0] != "v1":
            return None

        telegram_id = int(parts[1])
        expires_at = int(parts[2])
        signature = parts[3]

        if expires_at < int(time.time()):
            return None

        payload = f"{telegram_id}:{expires_at}"
        expected_sig = hmac.new(
            secret_key.encode("utf-8"),
            payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected_sig, signature):
            return None

        return telegram_id
    except Exception:
        return None
