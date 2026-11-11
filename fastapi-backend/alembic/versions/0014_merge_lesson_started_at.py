"""Merge 0012_lesson_started_at (PR #3) with 0013_curriculum_restructure.

Both branches are independent: one adds lesson_progress.started_at, the other
renames legacy lesson ids inside lab_progress.lesson_progress.
"""

revision = "0014_merge_lesson_started_at"
down_revision = ("0012_lesson_started_at", "0013_curriculum_restructure")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
