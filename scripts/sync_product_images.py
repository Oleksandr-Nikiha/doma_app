#!/usr/bin/env python3
"""
Скрипт парсингу сайтів:
  - https://www.domacroissants.com.ua
  - https://domapizza.com.ua

Збирання фотографій позицій, локальне збереження в Directus Uploads volume,
створення записів у таблиці directus_files, оновлення таблиці products
(поле image та image_url) та інвалідація кешу.
"""

import asyncio
import io
import json
import os
import re
import ssl
import subprocess
import sys
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

import asyncpg
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from PIL import Image

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ПОМИЛКА: DATABASE_URL не знайдено в .env")
    sys.exit(1)

UPLOADS_DIR = Path("/home/alex/Development/doma_app/uploads")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}


def normalize_text(text: str) -> str:
    """Нормалізує рядок для нечіткого порівняння: прибирає пунктуацію,
    апострофи, пробіли, зводить до нижнього регістру."""
    if not text:
        return ""
    t = text.lower()
    t = t.replace("’", "").replace("'", "").replace("`", "").replace("ʼ", "")
    t = t.replace("і", "и").replace("ї", "и").replace("е", "є")
    t = re.sub(r"[^a-zа-я0-9]", "", t)
    return t


def quote_url(url: str) -> str:
    """Кодує не-ASCII символи у шляху та запиті URL (наприклад, кирилицю)."""
    parsed = urllib.parse.urlsplit(url)
    encoded_path = urllib.parse.quote(parsed.path, safe="/:@=+$,?#&")
    encoded_query = urllib.parse.quote(parsed.query, safe="/:@=+$,?#&")
    return urllib.parse.urlunsplit(
        (parsed.scheme, parsed.netloc, encoded_path, encoded_query, parsed.fragment)
    )


def fetch_url(url: str, timeout: int = 15) -> bytes | None:
    encoded_url = quote_url(url)
    req = urllib.request.Request(encoded_url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=timeout) as resp:
            return resp.read()
    except Exception as e:
        print(f"  Помилка завантаження {url}: {e}")
        return None


def parse_domacroissants() -> dict[str, str]:
    """Парсить каталог Doma Croissants через Tilda Store API."""
    print("=== Парсинг https://www.domacroissants.com.ua ===")
    storeparts = ["647442686442", "894840664982", "925891208941", "291965839651"]
    items: dict[str, str] = {}

    for sp in storeparts:
        api_url = f"https://store.tildaapi.one/api/getproductslist/?storepartuid={sp}&size=100"
        raw = fetch_url(api_url)
        if not raw:
            continue
        try:
            data = json.loads(raw.decode("utf-8"))
            for p in data.get("products", []):
                title = p.get("title", "").strip()
                if not title:
                    continue
                img_url = p.get("img")
                if not img_url and p.get("gallery"):
                    gallery = p.get("gallery")
                    if isinstance(gallery, str):
                        try:
                            gallery = json.loads(gallery)
                        except Exception:
                            gallery = []
                    if isinstance(gallery, list) and gallery:
                        img_url = gallery[0].get("img")
                if title and img_url:
                    items[title] = img_url
        except Exception as e:
            print(f"  Помилка обробки storepart {sp}: {e}")

    print(f"Знайдено позицій на domacroissants: {len(items)}")
    return items


def parse_domapizza() -> dict[str, str]:
    """Парсить сторінки меню https://domapizza.com.ua."""
    print("=== Парсинг https://domapizza.com.ua ===")
    pages = [
        "https://domapizza.com.ua/",
        "https://domapizza.com.ua/pizza/",
        "https://domapizza.com.ua/sushii/",
        "https://domapizza.com.ua/bowls/",
        "https://domapizza.com.ua/zakesky/",
        "https://domapizza.com.ua/deserty/",
        "https://domapizza.com.ua/napiy/",
    ]
    items: dict[str, str] = {}

    for page_url in pages:
        raw = fetch_url(page_url)
        if not raw:
            continue
        soup = BeautifulSoup(raw.decode("utf-8", errors="ignore"), "html.parser")
        for img in soup.find_all("img"):
            alt = img.get("alt", "").strip()
            src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
            if not alt or not src:
                continue
            if "svg" in src or "domapizzasushi" in alt.lower():
                continue
            if src.startswith("//"):
                src = "https:" + src
            if alt not in items:
                items[alt] = src

    print(f"Знайдено позицій на domapizza: {len(items)}")
    return items


# Словник ручних відповідностей для нетипових або комбінованих назв
MANUAL_MAPPINGS = {
    # Doma Croissants
    "з Лососем та імбирем": "З лососем та імберем круасан",
    "з Прошуто з В'яленими помідорами круасан": "з Прошуто та В'яленими помідорами круасан",
    "Дубайський круасан": "Дубайський крусан",
    "з Кокосом, маскарпоне та мигдалем": "з Кокосом, Маскарпоне та мигладем",
    "з Маскарпоне (з Абрикосом / Вишнею / Яблуком / Персиком)": "з Маскарпоне та Вишнею круасан",
    "Чотири сира": "Чотири сира",  # бенто-піца
    "Чотири м'яса": "Чотири м'яса",
    "Б'янко": "Let’s Bianco (Летс Б’янко)",
    "Салямі": "Салямі",
    "Маргарита": "Маргарита",
    # Doma Pizza напої
    "Кола": "Кола",
    "Coca-Cola": "Кола",
    "Coca Cola": "Кола",
}


def find_best_image_url(
    product_name: str,
    loc_name: str,
    croissant_items: dict[str, str],
    pizza_items: dict[str, str],
    current_image_url: str | None,
) -> str | None:
    """Знаходить найкраще посилання на зображення для страви."""
    is_croissant_loc = "croissant" in loc_name.lower()

    # 1. Ручний маппінг
    if product_name in MANUAL_MAPPINGS:
        mapped_name = MANUAL_MAPPINGS[product_name]
        if mapped_name in croissant_items:
            return croissant_items[mapped_name]
        if mapped_name in pizza_items:
            return pizza_items[mapped_name]

    # 2. Прямий збіг у цільовому магазині
    primary_dict = croissant_items if is_croissant_loc else pizza_items
    secondary_dict = pizza_items if is_croissant_loc else croissant_items

    if product_name in primary_dict:
        return primary_dict[product_name]

    # 3. Нормалізований збіг
    norm_p = normalize_text(product_name)
    for k, v in primary_dict.items():
        if normalize_text(k) == norm_p:
            return v

    for k, v in secondary_dict.items():
        if normalize_text(k) == norm_p:
            return v

    # 4. Частковий збіг (підрядок)
    for k, v in primary_dict.items():
        norm_k = normalize_text(k)
        if norm_p and (norm_p in norm_k or norm_k in norm_p):
            return v

    for k, v in secondary_dict.items():
        norm_k = normalize_text(k)
        if norm_p and (norm_p in norm_k or norm_k in norm_p):
            return v

    # 5. Якщо в базі вже є валідний url з domapizza
    if current_image_url and current_image_url.startswith("http"):
        return current_image_url

    return None


async def run_sync():
    conn = await asyncpg.connect(DATABASE_URL)
    print("Підключено до PostgreSQL!")

    # 1. Застосовуємо міграцію
    migration_file = (
        Path("/home/alex/Development/doma_app/db/migrations/0009_product_images_directus.sql")
    )
    if migration_file.exists():
        print("Застосування міграції 0009_product_images_directus.sql...")
        migration_sql = migration_file.read_text(encoding="utf-8")
        await conn.execute(migration_sql)
        print("Міграцію успішно застосовано!")

    # 2. Збираємо дані із сайтів
    croissant_items = parse_domacroissants()
    pizza_items = parse_domapizza()

    # 3. Читаємо всі продукти
    products = await conn.fetch("""
        SELECT p.id, p.name, p.image_url, p.image, c.name as category_name, l.name as location_name
        FROM products p
        JOIN categories c ON c.id = p.category_id
        JOIN locations l ON l.id = c.location_id
        ORDER BY l.name, c.sort_order, p.sort_order;
    """)
    print(f"\nУсього страв у базі даних: {len(products)}")

    downloaded_files: list[tuple[str, str]] = []  # (local_path, filename_disk)
    matched_count = 0
    updated_count = 0
    skipped_count = 0

    for prod in products:
        p_id = prod["id"]
        p_name = prod["name"]
        loc_name = prod["location_name"]
        curr_url = prod["image_url"]

        img_source_url = find_best_image_url(
            p_name, loc_name, croissant_items, pizza_items, curr_url
        )

        if not img_source_url:
            print(f"⚠️  [{p_id}] {loc_name} / {p_name} — зображення не знайдено")
            skipped_count += 1
            continue

        matched_count += 1

        # Завантажуємо зображення
        img_bytes = fetch_url(img_source_url)
        if not img_bytes:
            print(f"❌ [{p_id}] {p_name} — не вдалося завантажити {img_source_url}")
            continue

        # Визначаємо параметри картинки
        try:
            with Image.open(io.BytesIO(img_bytes)) as pil_img:
                width, height = pil_img.size
                img_format = pil_img.format.lower() if pil_img.format else "jpeg"
        except Exception as e:
            print(f"❌ [{p_id}] {p_name} — помилка розпізнавання картинки: {e}")
            continue

        ext_map = {
            "webp": ("webp", "image/webp"),
            "jpeg": ("jpeg", "image/jpeg"),
            "jpg": ("jpeg", "image/jpeg"),
            "png": ("png", "image/png"),
            "gif": ("gif", "image/gif"),
        }
        ext, mime_type = ext_map.get(img_format, ("jpeg", "image/jpeg"))

        # Стабільний детермінований UUID
        file_uuid = uuid.uuid5(uuid.NAMESPACE_URL, f"doma_product_img_{p_id}")
        filename_disk = f"{file_uuid}.{ext}"
        sanitized_title = re.sub(r'[\\/*?:"<>|]', "", p_name).replace(" ", "_")
        filename_download = f"{sanitized_title}.{ext}"
        filesize = len(img_bytes)

        # Зберігаємо файл локально
        local_path = UPLOADS_DIR / filename_disk
        local_path.write_bytes(img_bytes)
        downloaded_files.append((str(local_path), filename_disk))

        # Записуємо у directus_files
        await conn.execute(
            """
            INSERT INTO directus_files (
                id, storage, filename_disk, filename_download, title,
                type, filesize, width, height, uploaded_on
            ) VALUES (
                $1, 'local', $2, $3, $4,
                $5, $6, $7, $8, now()
            )
            ON CONFLICT (id) DO UPDATE SET
                filename_disk = EXCLUDED.filename_disk,
                filename_download = EXCLUDED.filename_download,
                title = EXCLUDED.title,
                type = EXCLUDED.type,
                filesize = EXCLUDED.filesize,
                width = EXCLUDED.width,
                height = EXCLUDED.height,
                modified_on = now();
            """,
            file_uuid,
            filename_disk,
            filename_download,
            p_name,
            mime_type,
            filesize,
            width,
            height,
        )

        # Оновлюємо products
        new_image_url = f"/api/uploads/{filename_disk}"
        await conn.execute(
            """
            UPDATE products
            SET image = $1,
                image_url = $2
            WHERE id = $3;
            """,
            file_uuid,
            new_image_url,
            p_id,
        )

        updated_count += 1
        print(f"✅ [{p_id}] {p_name} -> {filename_disk} ({width}x{height}, {filesize // 1024} KB)")

    print("\nПідсумок:")
    print(f"  Всього знайдено відповідностей: {matched_count}/{len(products)}")
    print(f"  Успішно оновлено в БД та збережено: {updated_count}")
    print(f"  Без фото (прибори, порційні соуси): {skipped_count}")

    # 4. Копіюємо всі завантажені файли у контейнер Directus (том directus_uploads)
    print("\nКопіювання файлів у Docker-контейнер doma_app-directus-1...")
    try:
        res = subprocess.run(
            ["docker", "cp", f"{UPLOADS_DIR}/.", "doma_app-directus-1:/directus/uploads/"],
            capture_output=True,
            text=True,
        )
        if res.returncode == 0:
            print("  Усі файли успішно скопійовано в том directus_uploads!")
        else:
            print(f"  Помилка копіювання: {res.stderr}")
    except Exception as e:
        print(f"  Помилка виклику docker cp: {e}")

    # 5. Очищаємо кеш Redis для каталогу
    print("\nОчищення кешу Redis для каталогу...")
    try:
        import redis.asyncio as aioredis

        r = aioredis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
        keys = await r.keys("catalog:*")
        if keys:
            await r.delete(*keys)
            print(f"  Видалено ключів кешу: {len(keys)}")
        else:
            print("  Кеш каталогу вже чистий.")
        await r.aclose()
    except Exception as e:
        print(f"  Помилка очищення кешу Redis: {e}")

    await conn.close()
    print("\nГотово! Перезапуск контейнера directus для скидання внутрішнього кешу...")
    subprocess.run(["docker", "restart", "doma_app-directus-1"], capture_output=True)
    print("Directus перезапущено!")


if __name__ == "__main__":
    asyncio.run(run_sync())
