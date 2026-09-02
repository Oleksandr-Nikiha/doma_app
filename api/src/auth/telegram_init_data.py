import hmac
import hashlib
import time
import urllib.parse
import json

def validate_init_data(init_data: str, bot_token: str, max_age_seconds: int = 86400) -> dict:
    """
    Перевіряє підпис initData від Telegram.
    Повертає розпарсені дані (dict) якщо валідно.
    Кидає ValueError з описом причини, якщо ні.
    """

    parsed_pairs = urllib.parse.parse_qsl(init_data)
    parsed_data = dict(parsed_pairs)
    
    if "hash" not in parsed_data:
        raise ValueError("Відсутній параметр 'hash' у даних")
        
    received_hash = parsed_data.pop("hash")
    
    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(parsed_data.items())
    )
    
    secret_key = hmac.new(
        key=b"WebAppData",
        msg=bot_token.encode("utf-8"),
        digestmod=hashlib.sha256
    ).digest()
    
    calculated_hash = hmac.new(
        key=secret_key,
        msg=data_check_string.encode("utf-8"),
        digestmod=hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(calculated_hash, received_hash):
        raise ValueError("Невалідний підпис: hash не співпадає")
        
    if "auth_date" not in parsed_data:
        raise ValueError("Відсутній параметр 'auth_date' у даних")
        
    try:
        auth_date = int(parsed_data["auth_date"])
    except ValueError:
        raise ValueError("Параметр 'auth_date' має бути цілим числом")
        
    current_time = time.time()
    if current_time - auth_date > max_age_seconds:
        raise ValueError(f"Дані застаріли (вік перевищує {max_age_seconds} секунд)")
        
    result = parsed_data.copy()
    for json_field in ("user", "receiver", "chat"):
        if json_field in result:
            try:
                result[json_field] = json.loads(result[json_field])
            except json.JSONDecodeError:
                pass

    return result