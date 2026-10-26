"""Per-class pilot switch and activity index for reports.

Existing classes keep the behaviour they had under the global flag ('enabled').
Downgrade retains the column and index; re-upgrade is idempotent.
"""

from alembic import op

revision = "0010_class_lms_mode"
down_revision = "0009_quizzes"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "ALTER TABLE classes ADD COLUMN IF NOT EXISTS lms_mode TEXT NOT NULL DEFAULT 'enabled'"
    )
    op.execute("ALTER TABLE classes DROP CONSTRAINT IF EXISTS ck_class_lms_mode")
    op.execute(
        "ALTER TABLE classes ADD CONSTRAINT ck_class_lms_mode "
        "CHECK (lms_mode IN ('enabled','read_only','off'))"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_progress_events_member_time "
        "ON progress_events(membership_id, created_at)"
    )


def downgrade():
    # Deliberately preserve the pilot state of every class for a later re-upgrade.
    pass
