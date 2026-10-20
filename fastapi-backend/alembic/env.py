import asyncio

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context
from app.core.config import get_settings
from app.models.tables import Base

config = context.config
target_metadata = Base.metadata


def run_migrations(connection):
    def include_object(obj, name, kind, reflected, compare_to):
        # Monthly/default partitions are managed by migration SQL, not ORM tables.
        return not (
            kind == "table" and reflected and compare_to is None and name.startswith("telemetry_")
        )

    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_online():
    engine = create_async_engine(get_settings().async_database_url, poolclass=pool.NullPool)
    async with engine.connect() as connection:
        await connection.run_sync(run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    raise RuntimeError("These migrations require an online PostgreSQL connection.")
elif config.attributes.get("connection") is not None:
    run_migrations(config.attributes["connection"])
else:
    asyncio.run(run_online())
