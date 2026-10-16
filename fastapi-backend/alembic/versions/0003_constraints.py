"""Normalize authentication types and enforce ORM nullability."""
from alembic import op
import sqlalchemy as sa

revision = '0003_constraints'
down_revision = '0002_platform_schema'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    for table, column in [('google_identities', 'subject'), ('auth_revoked_tokens', 'token_hash')]:
        current = next(c for c in sa.inspect(bind).get_columns(table) if c['name'] == column)
        if not isinstance(current['type'], sa.Text):
            op.alter_column(table, column, type_=sa.Text(), existing_type=current['type'])
    defaults = [('devices', 'status', "'offline'"), ('devices', 'enabled', 'TRUE'),
                ('mqtt_credentials', 'enabled', 'TRUE'), ('commands', 'status', "'pending'"),
                ('lab_progress', 'video_watched', 'FALSE'), ('lab_progress', 'doc_viewed', 'FALSE')]
    for table, column, default in defaults:
        current = next(c for c in sa.inspect(bind).get_columns(table) if c['name'] == column)
        if current['nullable']:
            op.execute(f'UPDATE {table} SET {column}={default} WHERE {column} IS NULL')
            op.alter_column(table, column, nullable=False, existing_type=current['type'])


def downgrade():
    raise RuntimeError('This migration is forward-only; restore a backup to roll back.')
