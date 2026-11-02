from functools import lru_cache
from typing import AsyncGenerator

from fastapi import HTTPException
from loguru import logger
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings
from app.db.connection import CONNECT_TIMEOUT, connect_database


class Base(DeclarativeBase):
    pass


def _normalize_database_url(database_url: str) -> str:
    url = database_url.strip()
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url.removeprefix("postgres://")
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url.removeprefix("postgresql://")
    return url


@lru_cache
def get_database_url() -> str:
    database_url = get_settings().async_database_url
    if not database_url:
        raise RuntimeError("DATABASE_URL chưa được cấu hình")
    return _normalize_database_url(database_url)


@lru_cache
def get_engine():
    return create_async_engine(
        get_database_url(),
        echo=False,
        future=True,
        pool_pre_ping=True,
        connect_args={"timeout": CONNECT_TIMEOUT},
    )


@lru_cache
def get_session_maker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(
        bind=get_engine(),
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    if not get_settings().database_url:
        raise HTTPException(503, "Chưa cấu hình DATABASE_URL cho PostgreSQL trên máy chủ.")
    session_maker = get_session_maker()
    async with session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


async def close_db() -> None:
    await get_engine().dispose()


async def check_database_connection() -> None:
    """Read-only connection probe, including databases not yet migrated."""
    async with connect_database(get_engine()) as conn:
        await conn.execute(text("SELECT 1"))


async def init_db() -> None:
    """Check connectivity and migration head; startup never mutates the schema."""
    from alembic.migration import MigrationContext
    from alembic.script import ScriptDirectory

    from app.db.migrations import migration_config

    if not get_settings().database_url:
        raise RuntimeError("DATABASE_URL must be configured before startup.")
    async with connect_database(get_engine()) as conn:
        heads = await conn.run_sync(
            lambda sync: MigrationContext.configure(sync).get_current_heads()
        )
        expected = ScriptDirectory.from_config(migration_config()).get_heads()
        if set(heads) != set(expected):
            raise RuntimeError(
                "Database migrations are pending. Run python -m alembic upgrade head."
            )
        await conn.execute(text("SELECT 1"))
    logger.success("[DB] Database connected; migrations are current.")
