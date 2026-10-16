import logging
import os
import uuid
from pathlib import Path

import aiofiles
import asyncpg
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from src.auth.deps import get_current_staff

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"}
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg+xml",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _get_uploads_dir() -> Path:
    env_dir = os.environ.get("UPLOADS_DIR", "/app/uploads")
    path = Path(env_dir)
    if not path.is_dir():
        path = Path(__file__).resolve().parent.parent.parent.parent / "uploads"
    path.mkdir(parents=True, exist_ok=True)
    return path


@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """
    Завантажує зображення страви або банера безпосередньо з адмін-панелі.
    Зберігає локально у сховище та повертає публічний відносний URL (/api/uploads/...).
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Файл не має назви",
        )

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Непідтримуваний формат файлу ({ext}). Дозволено: {allowed}",
        )

    if file.content_type and file.content_type.lower() not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Непідтримуваний MIME-тип ({file.content_type})",
        )

    # Читаємо вміст файлу та перевіряємо розмір
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Розмір файлу перевищує ліміт {MAX_FILE_SIZE // (1024 * 1024)} МБ",
        )

    # Генеруємо унікальне ім'я файлу
    unique_name = f"{uuid.uuid4().hex[:16]}{ext}"
    uploads_dir = _get_uploads_dir()
    file_path = uploads_dir / unique_name

    try:
        async with aiofiles.open(file_path, "wb") as out_file:
            await out_file.write(content)
    except Exception as exc:
        logger.error("Помилка збереження завантаженого файлу %s: %s", unique_name, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не вдалося зберегти файл на сервері",
        ) from exc

    public_url = f"/api/uploads/{unique_name}"
    logger.info(
        "Адміністратор %s успішно завантажив зображення: %s (%d байт)",
        staff["full_name"],
        public_url,
        len(content),
    )

    return {
        "url": public_url,
        "filename": unique_name,
        "size": len(content),
    }
