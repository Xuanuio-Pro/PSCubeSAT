"""Create legacy baseline, or adopt an intact pre-Alembic database."""
from pathlib import Path
from alembic import op
from sqlalchemy import inspect

revision = '0001_baseline'
down_revision = None
branch_labels = None
depends_on = None


async def create_baseline(connection):
    raw = await connection.get_raw_connection()
    await raw.driver_connection.execute(Path(__file__).with_suffix('.sql').read_text(encoding='utf-8'))


def upgrade():
    tables = set(inspect(op.get_bind()).get_table_names())
    required = {'users', 'devices', 'mqtt_credentials', 'mqtt_acl', 'telemetry', 'commands', 'lab_progress'}
    if 'users' in tables:
        if missing := required - tables:
            raise RuntimeError(f'Incomplete legacy schema; missing tables: {sorted(missing)}')
        return
    op.run_async(create_baseline)


def downgrade():
    raise RuntimeError('Baseline adoption is forward-only; restore a verified backup to roll back.')
