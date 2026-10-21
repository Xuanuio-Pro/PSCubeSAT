"""Prepare a fresh managed DB deployment without printing or committing secrets.

Run in the backend image with the server checkout mounted at --root. This edits
env files only; it never starts/stops containers or resets an existing DB volume.
"""

import argparse
import re
import secrets
import sys
from pathlib import Path

from dotenv import dotenv_values, set_key
from sqlalchemy.engine import URL, make_url

from app.core.config import Settings, validate_production


def prepare(root: Path, project: str, frontend_port: int, tunnel: bool, release_tag: str):
    server_env = root / ".env.server"
    server = dotenv_values(server_env, interpolate=False) if server_env.exists() else {}
    backend_file = server.get("BACKEND_ENV_FILE") or "./fastapi-backend/.env"
    backend_env = root / backend_file
    if not backend_env.is_file():
        raise RuntimeError("Missing backend env file. Configure MQTT credentials before setup.")
    backend = dotenv_values(backend_env, interpolate=False)
    token_file = server.get("TUNNEL_ENV_FILE") or "./.env"
    if tunnel:
        token_path = root / token_file
        if not token_path.is_file() or not dotenv_values(token_path, interpolate=False).get(
            "TUNNEL_TOKEN"
        ):
            raise RuntimeError("TUNNEL_ENV_FILE must contain the existing TUNNEL_TOKEN.")
    password = server.get("POSTGRES_PASSWORD")
    reused_password = bool(password)
    if not password:
        previous_url = backend.get("DATABASE_URL")
        if previous_url:
            try:
                password = make_url(previous_url).password
            except Exception:
                raise RuntimeError("Invalid existing DATABASE_URL; fix it before setup.") from None
        password = password or secrets.token_hex(32)
    db_user = server.get("POSTGRES_USER") or "cubesat"
    db_name = server.get("POSTGRES_DB") or "cubesat"
    domain = server.get("SITE_DOMAIN") or "cubesat.p-tech.xyz"
    database_url = URL.create(
        "postgresql+asyncpg",
        username=db_user,
        password=password,
        host="postgres",
        port=5432,
        database=db_name,
    ).render_as_string(hide_password=False)
    settings = Settings(
        _env_file=None,
        app_env="production",
        database_url=database_url,
        allowed_origins=f"https://{domain}",
        jwt_secret=backend.get("JWT_SECRET") or "",
        mqtt_password=backend.get("MQTT_PASSWORD") or "",
    )
    generated_jwt = False
    try:
        validate_production(settings)
    except RuntimeError as error:
        if not str(error).startswith("JWT_SECRET"):
            raise
        settings.jwt_secret = secrets.token_hex(32)
        generated_jwt = True
        validate_production(settings)
    # All required inputs have been validated before any file is edited.
    updates = {
        "SERVER_PROJECT": project,
        "SITE_DOMAIN": domain,
        "RELEASE_TAG": release_tag or server.get("RELEASE_TAG") or "server-db",
        "FRONTEND_PORT": str(frontend_port),
        "BACKEND_ENV_FILE": backend_file,
        "TUNNEL_ENV_FILE": token_file,
        "POSTGRES_USER": db_user,
        "POSTGRES_DB": db_name,
        "POSTGRES_PASSWORD": password,
    }
    for key, value in updates.items():
        set_key(str(server_env), key, value, quote_mode="always")
    for key, value in {
        "APP_ENV": "production",
        "PORT": "8000",
        "DATABASE_URL": database_url,
        "ALLOWED_ORIGINS": f"https://{domain}",
        "REDIS_URL": "redis://redis:6379",
        "JWT_SECRET": settings.jwt_secret,
        "COMPILER_IMAGE": "pscubesat-compiler:server-db",
    }.items():
        set_key(str(backend_env), key, value, quote_mode="always")
    return generated_jwt, reused_password


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--project", default="pscubesat")
    parser.add_argument("--frontend-port", type=int, default=5173)
    parser.add_argument("--release-tag", default="")
    parser.add_argument("--tunnel", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.frontend_port <= 65535:
        raise RuntimeError("Frontend port must be between 1 and 65535.")
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", args.project):
        raise RuntimeError("Use a lowercase Docker Compose project name.")
    generated, _ = prepare(
        args.root.resolve(), args.project, args.frontend_port, args.tunnel, args.release_tag
    )
    print("PASS env configured for managed PostgreSQL at postgres:5432; secret values omitted.")
    if generated:
        print("Generated JWT_SECRET because the existing value was missing/weak; sign in again.")
    print("Existing volumes and services have not been modified. Next: build, probe, migrate, up.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(
            f"FAIL setup: {error if isinstance(error, RuntimeError) else type(error).__name__}",
            file=sys.stderr,
        )
        raise SystemExit(1) from None
