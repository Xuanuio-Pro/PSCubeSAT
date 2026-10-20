"""
core/redis.py
─────────────
Singleton async Redis client — dùng chung cho toàn bộ ứng dụng.
"""

import asyncio
from contextlib import suppress
from typing import Optional

import redis.asyncio as aioredis
from loguru import logger

from app.core.config import get_settings

_redis_client: Optional[aioredis.Redis] = None


async def init_redis() -> None:
    """Khởi tạo kết nối Redis khi ứng dụng khởi động."""
    global _redis_client
    settings = get_settings()
    client = aioredis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
    )
    try:
        await client.ping()
    except asyncio.CancelledError:
        with suppress(Exception):
            await client.aclose()
        raise
    except Exception as exc:
        with suppress(Exception):
            await client.aclose()
        logger.warning(f"[Redis] Connection unavailable: {type(exc).__name__}")
        _redis_client = None
    else:
        _redis_client = client
        logger.success("[Redis] Connected")


async def close_redis() -> None:
    """Đóng kết nối Redis khi ứng dụng tắt."""
    global _redis_client
    client, _redis_client = _redis_client, None
    if client:
        await client.aclose()
        logger.info("[Redis] 🔌 Đã đóng kết nối Redis.")


def get_redis() -> Optional[aioredis.Redis]:
    """Trả về Redis client hiện tại. None nếu chưa khởi tạo hoặc lỗi kết nối."""
    return _redis_client
