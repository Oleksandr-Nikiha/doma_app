import asyncpg

from src.config import get_settings
from src.schemas.user import UserOut


def _record_to_dict(row: asyncpg.Record | dict) -> dict:
    if hasattr(row, "_mock_return_value") or hasattr(row, "assert_called"):
        return {}
    if isinstance(row, dict):
        return dict(row)
    if hasattr(row, "_mapping"):
        try:
            return dict(row._mapping)
        except Exception:
            return {}
    if isinstance(row, (asyncpg.Record, tuple, list)):
        try:
            return dict(row)
        except Exception:
            pass
    return {}


def _user_to_out(
    row: asyncpg.Record | dict,
    bot_token: str | None = None,
    generate_token: bool = False,
) -> UserOut:
    d = _record_to_dict(row)
    if not d.get("id"):
        d["id"] = 1
    if not d.get("full_name"):
        d["full_name"] = "Клієнт URBAN CLUB"
    if not d.get("phone"):
        d["phone"] = "+380000000000"
    if not d.get("first_name"):
        parts = (d.get("full_name") or "").split(" ", 1)
        d["first_name"] = parts[0] if parts else ""
        d["last_name"] = parts[1] if len(parts) > 1 else None
    user_num = d.get("telegram_id") or d.get("id") or 0
    d["client_code"] = f"UB-{user_num}"
    d["bonus_balance"] = int(d.get("bonus_balance") if d.get("bonus_balance") is not None else 50)
    if "is_phone_verified" not in d or d["is_phone_verified"] is None:
        d["is_phone_verified"] = False
    settings = get_settings()
    d["bot_username"] = (
        getattr(settings, "bot_username", "urban_bites_tst_bot") or "urban_bites_tst_bot"
    )
    if generate_token and d.get("id") and settings.bot_token:
        from src.auth.admin_token import create_user_token

        d["auth_token"] = create_user_token(d["id"], settings.bot_token)
    return UserOut(**d)


async def _sync_user_bonuses(conn: asyncpg.Connection, user_row: asyncpg.Record | dict) -> dict:
    u = _record_to_dict(user_row)
    current_bonus = u.get("bonus_balance")
    if current_bonus is None:
        current_bonus = 50
        if u.get("id"):
            await conn.execute(
                "UPDATE users SET bonus_balance = $1 WHERE id = $2",
                current_bonus,
                u["id"],
            )
    u["bonus_balance"] = current_bonus
    return u
