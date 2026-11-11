"""Track server-side lesson start time for minimum learning duration."""

from alembic import op

revision = "0012_lesson_started_at"
down_revision = "0011_legacy_lesson_progress"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ"
    )


def downgrade():
    # Keep additive progress data during downgrade.
    pass
