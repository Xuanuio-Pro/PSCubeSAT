from pathlib import Path

from alembic.config import Config


def migration_config():
    return Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
