# CubeSat FastAPI backend

ASGI entrypoint: `app.main:app`. Runtime settings are read from this directory's `.env`.

Production template: `.env.production.example`. `APP_ENV=production` validates JWT, DB configuration, exact HTTPS origins and the MQTT service password before startup. Run `python server_preflight.py` to check settings without printing secrets; add `--live` after migrations to verify DB head, Redis and compiler image availability. Server Compose runs migrations before starting one API worker. See [server migration guide](../Docs/SERVER_MIGRATION_CUBESAT.md).

## Layout and responsibilities

```text
app/
  main.py                 ASGI entrypoint and compatibility exports
  application.py          App factory, middleware, HTTP/WebSocket route registration
  lifespan.py             Startup, background tasks and resource cleanup
  core/                   Settings, logging, security, Redis and MQTT transport policy
  db/                     SQLAlchemy engine/session and migration configuration
  models/                 ORM tables, telemetry contract and runtime models
  schemas/                HTTP input/output validation
  routers/                HTTP transport, dependencies and response status codes
  services/               Use cases, transactions and orchestration
  repository/             Database reads/writes; no commit or HTTP responses
  websocket/              Device rooms, socket authorization and message transport
  integrations/           External adapters; legacy Mosquitto adapter is isolated here
  tests/                  Unit, HTTP/WS, lifecycle and PostgreSQL integration tests
alembic/                  Versioned database migrations
compiler/                 Trusted compiler container scripts and firmware library overrides
emqx/                     PostgreSQL authentication/authorization queries and grants
scripts/                  Operational diagnostics and backend quality checks
```

Routes validate HTTP input and invoke use cases. Services own transactions; repositories flush/query without deciding when to commit. ORM tables have one definition in `models/tables.py`. Existing `models/db_models.py` and uppercase MQTT repository modules remain import shims; new code uses the canonical modules.

Device registration, rotation and revocation use PostgreSQL directly. `integrations/legacy_mosquitto.py` retains the old local Docker/file adapter for compatibility; it is not called by the current EMQX/PostgreSQL flow. MQTT probing uses `scripts/mqtt_probe.py`; the old hardcoded CA diagnostic in the tests folder has been removed.

## Install and run

```powershell
python -m pip install -r requirements-dev.txt
python -m alembic upgrade head
python dev.py
```

The development launcher retains Windows reload behavior. Compiler subprocesses still use the existing Proactor bridge; MQTT uses the application's compatible event loop. Startup checks schema version and does not migrate automatically. The app factory opens no network connections. Lifespan owns DB, Redis and MQTT resources and closes initialized resources if startup fails partway through.

Existing project root npm commands continue to work. For deployment use the configured Uvicorn/Docker entrypoint and environment. See `../Docs/EMQX_POSTGRES_SETUP.md` for broker-side PostgreSQL integration; the local database is not automatically reachable from the external broker.

## Format, lint and tests

```powershell
# Run from fastapi-backend; the helper also works from any cwd.
python scripts/check_backend.py
python scripts/check_backend.py --postgres
python scripts/check_backend.py --fix

# Individual commands:
python -m ruff check .
python -m ruff format . --check
python -m unittest discover -s app/tests -p 'test_*.py'
```

`--postgres` enables integration tests that create and remove isolated `pscubesat_test_*` databases. It requires the existing local PostgreSQL test/admin configuration. It does not run tests against arbitrary production databases. `--fix` applies Ruff's safe import fixes and formatter, then runs regression tests.

Formatting policy is in `pyproject.toml`: Python 3.10-compatible syntax, 100 columns, sorted imports, double quotes and consistent indentation. Ruff is a development dependency only.

`app/firmware/export_flash_manifest.py` is intentionally excluded from formatting: its exact text is part of the compiler image fingerprint. SCons injects its `env` global, which is acknowledged with a file-specific lint setting. Changing that asset requires rebuilding/verifying the compiler image. Firmware C++ and runtime caches are outside the Python formatter's scope.
