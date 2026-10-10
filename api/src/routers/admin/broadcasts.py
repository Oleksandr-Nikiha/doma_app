import asyncio
import json
import logging
import urllib.error
import urllib.request

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status

from src.auth.deps import get_current_admin
from src.config import get_settings
from src.db.connection import get_pool
from src.schemas.admin import (
    BroadcastCreateIn,
    BroadcastOut,
    BroadcastRecipientsCountOut,
)

logger = logging.getLogger(__name__)

router = APIRouter()

def _send_single_telegram_broadcast(
    token: str,
    chat_id: int,
    text: str,
    image_url: str | None,
    reply_markup: dict | None,
) -> bool:
    data: dict = {
        "chat_id": chat_id,
        "parse_mode": "HTML",
    }
    if image_url:
        url = f"https://api.telegram.org/bot{token}/sendPhoto"
        data["photo"] = image_url
        data["caption"] = text
    else:
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        data["text"] = text

    if reply_markup:
        data["reply_markup"] = reply_markup

    raw_body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=raw_body,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            resp.read()
        return True
    except urllib.error.HTTPError as err:
        # Якщо сталася помилка через HTML-теги, робимо fallback на звичайний текст
        if err.code == 400 and "parse_mode" in data:
            data.pop("parse_mode", None)
            fallback_req = urllib.request.Request(
                url,
                data=json.dumps(data).encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
            try:
                with urllib.request.urlopen(fallback_req, timeout=8) as resp:
                    resp.read()
                return True
            except Exception:
                pass
        logger.warning("Не вдалося надіслати розсилку chat_id=%s: %s", chat_id, err)
        return False
    except Exception as e:
        logger.warning("Помилка надсилання розсилки chat_id=%s: %s", chat_id, e)
        return False


async def _send_broadcast_worker(
    broadcast_id: int,
    recipients: list[int],
    payload_dict: dict,
    bot_token: str,
    pool: asyncpg.Pool,
) -> None:
    sent_count = 0
    failed_count = 0

    text = payload_dict["text"]
    image_url = payload_dict.get("image_url")
    button_text = payload_dict.get("button_text")
    button_url = payload_dict.get("button_url")

    reply_markup = None
    if button_text and button_url:
        reply_markup = {
            "inline_keyboard": [[{"text": button_text, "url": button_url}]]
        }

    for tid in recipients:
        success = await asyncio.to_thread(
            _send_single_telegram_broadcast,
            bot_token,
            tid,
            text,
            image_url,
            reply_markup,
        )
        if success:
            sent_count += 1
        else:
            failed_count += 1

        # Ліміт Telegram Bot API: не більше 30 повідомлень/сек
        await asyncio.sleep(0.04)

    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE broadcasts
            SET status = 'completed',
                sent_count = $1,
                failed_count = $2,
                completed_at = now()
            WHERE id = $3
            """,
            sent_count,
            failed_count,
            broadcast_id,
        )


async def _get_segment_recipients(conn: asyncpg.Connection, segment: str) -> list[int]:
    if segment == "all":
        rows = await conn.fetch("SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL")
    elif segment == "active_30d":
        rows = await conn.fetch(
            """
            SELECT DISTINCT telegram_id
            FROM orders
            WHERE status NOT IN ('rejected', 'cancelled')
              AND created_at >= now() - INTERVAL '30 days'
            """
        )
    elif segment == "inactive":
        rows = await conn.fetch(
            """
            SELECT telegram_id
            FROM users
            WHERE telegram_id NOT IN (
                SELECT DISTINCT telegram_id
                FROM orders
                WHERE status NOT IN ('rejected', 'cancelled')
                  AND created_at >= now() - INTERVAL '30 days'
            )
            """
        )
    elif segment == "top_orders":
        rows = await conn.fetch(
            """
            SELECT telegram_id
            FROM orders
            WHERE status NOT IN ('rejected', 'cancelled')
            GROUP BY telegram_id
            HAVING COUNT(*) >= 2
            ORDER BY COUNT(*) DESC
            """
        )
    else:
        rows = []
    return [r["telegram_id"] for r in rows if r["telegram_id"]]


@router.get("/broadcasts/recipients-count", response_model=BroadcastRecipientsCountOut)
async def get_broadcast_recipients_count(
    segment: str = Query("all", regex="^(all|active_30d|inactive|top_orders)$"),
    admin: asyncpg.Record = Depends(get_current_admin),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Повертає орієнтовну кількість клієнтів в обраному сегменті.
    """
    async with pool.acquire() as conn:
        recipients = await _get_segment_recipients(conn, segment)
    return BroadcastRecipientsCountOut(segment=segment, count=len(recipients))


@router.post("/broadcasts", response_model=BroadcastOut)
async def create_broadcast(
    payload: BroadcastCreateIn,
    background_tasks: BackgroundTasks,
    admin: asyncpg.Record = Depends(get_current_admin),
    settings=Depends(get_settings),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Створює розсилку та запускає відправку клієнтам у фоні.
    """
    async with pool.acquire() as conn:
        recipients = await _get_segment_recipients(conn, payload.segment)
        if not recipients:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="В обраному сегменті немає жодного користувача для розсилки",
            )

        row = await conn.fetchrow(
            """
            INSERT INTO broadcasts (
                author_id, title, text, image_url, button_text, button_url,
                segment, status, total_recipients
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'sending', $8)
            RETURNING id, author_id, title, text, image_url, button_text, button_url,
                      segment, status, total_recipients, sent_count, failed_count,
                      created_at, completed_at
            """,
            admin["telegram_id"],
            payload.title,
            payload.text,
            payload.image_url,
            payload.button_text,
            payload.button_url,
            payload.segment,
            len(recipients),
        )

    background_tasks.add_task(
        _send_broadcast_worker,
        row["id"],
        recipients,
        payload.model_dump(),
        settings.bot_token,
        pool,
    )

    return BroadcastOut(
        id=row["id"],
        author_id=row["author_id"],
        author_name=admin["full_name"],
        title=row["title"],
        text=row["text"],
        image_url=row["image_url"],
        button_text=row["button_text"],
        button_url=row["button_url"],
        segment=row["segment"],
        status=row["status"],
        total_recipients=row["total_recipients"],
        sent_count=row["sent_count"],
        failed_count=row["failed_count"],
        created_at=row["created_at"].isoformat(),
        completed_at=row["completed_at"].isoformat() if row["completed_at"] else None,
    )


@router.get("/broadcasts", response_model=list[BroadcastOut])
async def list_broadcasts(
    admin: asyncpg.Record = Depends(get_current_admin),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Повертає історію проведених розсилок.
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT b.*, u.full_name AS author_name
            FROM broadcasts b
            LEFT JOIN users u ON u.telegram_id = b.author_id
            ORDER BY b.created_at DESC
            LIMIT 50
            """
        )

    return [
        BroadcastOut(
            id=r["id"],
            author_id=r["author_id"],
            author_name=r["author_name"],
            title=r["title"],
            text=r["text"],
            image_url=r["image_url"],
            button_text=r["button_text"],
            button_url=r["button_url"],
            segment=r["segment"],
            status=r["status"],
            total_recipients=r["total_recipients"],
            sent_count=r["sent_count"],
            failed_count=r["failed_count"],
            created_at=r["created_at"].isoformat(),
            completed_at=r["completed_at"].isoformat() if r["completed_at"] else None,
        )
        for r in rows
    ]
