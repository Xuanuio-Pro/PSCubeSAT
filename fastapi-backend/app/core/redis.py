"""
core/redis.py
─────────────
Singleton async Redis client — dùng chung cho toàn bộ ứng dụng.
"""
from functools import lru_cache
from typing import Optional

import redis.asyncio as aioredis
from loguru import logger

from app.core.config import get_settings

_redis_client: Optional[aioredis.Redis] = None


async def init_redis() -> None:
    """Khởi tạo kết nối Redis khi ứng dụng khởi động."""
    global _redis_client
    settings = get_settings()
    try:
        _redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
        await _redis_client.ping()
        logger.success(f"[Redis] ✅ Kết nối Redis thành công: {settings.redis_url}")
    except Exception as e:
        logger.error(f"[Redis] ⚠️ Không thể kết nối Redis: {e}")
        _redis_client = None


async def close_redis() -> None:
    """Đóng kết nối Redis khi ứng dụng tắt."""
    global _redis_client
    if _redis_client:
        await _redis_client.aclose()
        _redis_client = None
        logger.info("[Redis] 🔌 Đã đóng kết nối Redis.")


def get_redis() -> Optional[aioredis.Redis]:
    """Trả về Redis client hiện tại. None nếu chưa khởi tạo hoặc lỗi kết nối."""
    return _redis_client
