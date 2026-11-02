"""Read-only server checks. Never print credentials or alter the database schema."""

import argparse
import asyncio
import sys

from app.core.config import get_settings, validate_production


async def live_checks():
    from redis.asyncio import Redis

    from app.db.database import close_db, init_db
    from app.services.compiler_sandbox import image_id

    try:
        await init_db()
        print("PASS PostgreSQL connectivity and migration head")
    finally:
        await close_db()
    redis = Redis.from_url(get_settings().redis_url, socket_connect_timeout=5, socket_timeout=5)
    try:
        await redis.ping()
        print("PASS Redis")
    finally:
        await redis.aclose()
    if not await image_id():
        raise RuntimeError("Compiler image unavailable on the Docker daemon used by the API.")
    print("PASS compiler image present (compile still needs an actual build check)")


async def database_check():
    from app.db.database import check_database_connection, close_db

    try:
        await check_database_connection()
        print("PASS PostgreSQL connectivity (SELECT 1; no schema changes)")
    finally:
        await close_db()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    checks = parser.add_mutually_exclusive_group()
    checks.add_argument(
        "--live", action="store_true", help="Check DB/migrations, Redis and Docker image"
    )
    checks.add_argument(
        "--database", action="store_true", help="Check only DB connectivity; no migration required"
    )
    args = parser.parse_args()
    settings = get_settings()
    if settings.app_env != "production":
        raise RuntimeError("APP_ENV must be production for server preflight.")
    validate_production(settings)
    from urllib.parse import urlsplit

    if urlsplit(settings.database_url).hostname in ("localhost", "127.0.0.1", "::1"):
        raise RuntimeError(
            "DATABASE_URL uses container localhost. Set a DB hostname reachable from Docker."
        )
    print("PASS production environment (secret values omitted)")
    if args.live:
        asyncio.run(live_checks())
    elif args.database:
        asyncio.run(database_check())


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Driver exceptions can embed connection strings; don't echo them.
        print(
            f"FAIL server preflight: {error if isinstance(error, RuntimeError) else type(error).__name__}",
            file=sys.stderr,
        )
        raise SystemExit(1) from None
