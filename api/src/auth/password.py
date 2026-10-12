import hashlib
import hmac
import os


def hash_password(password: str) -> str:
    """Хешує пароль за допомогою PBKDF2-HMAC-SHA256 з випадковою сіллю."""
    salt = os.urandom(16).hex()
    key = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000
    ).hex()
    return f"{salt}:{key}"


def verify_password(password: str, hashed: str | None) -> bool:
    """Перевіряє відповідність пароля збереженому хешу."""
    if not hashed or ":" not in hashed:
        return False
    try:
        salt, key = hashed.split(":", 1)
        new_key = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000
        ).hex()
        return hmac.compare_digest(key, new_key)
    except Exception:
        return False

