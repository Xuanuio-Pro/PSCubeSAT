"""Unlimited attempts for lesson quizzes and 5-attempt/30-minute cooldown batches for Lab Tests.

Allows `quiz_policies.max_attempts` to be NULL (meaning unlimited attempts) and adds
`quiz_policies.cooldown_minutes` (0..1440, 0 disables cooldown). Existing untouched
default policies (`max_attempts = 3, cooldown_minutes = 0`) are migrated to:
- `quiz`: `max_attempts = NULL, cooldown_minutes = 0`
- `labtest`: `max_attempts = 5, cooldown_minutes = 30`

Teacher-customized policies (`max_attempts != 3`) are left untouched. Downgrade
restores `max_attempts = 3` and drops `cooldown_minutes` without deleting any
attempt history.
"""

from alembic import op

revision = "0022_quiz_attempts_and_cooldown"
down_revision = "0021_default_sample_quiz_banks"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE quiz_policies ALTER COLUMN max_attempts DROP NOT NULL")
    op.execute("ALTER TABLE quiz_policies ALTER COLUMN max_attempts DROP DEFAULT")
    op.execute(
        "ALTER TABLE quiz_policies ADD COLUMN IF NOT EXISTS cooldown_minutes INTEGER NOT NULL DEFAULT 0"
    )
    op.execute("ALTER TABLE quiz_policies DROP CONSTRAINT IF EXISTS ck_quiz_policy")
    op.execute(
        """ALTER TABLE quiz_policies ADD CONSTRAINT ck_quiz_policy CHECK (
            num_questions BETWEEN 1 AND 200
            AND pass_score BETWEEN 1 AND 200
            AND time_limit_minutes BETWEEN 1 AND 180
            AND (max_attempts IS NULL OR max_attempts BETWEEN 1 AND 100)
            AND cooldown_minutes BETWEEN 0 AND 1440
        )"""
    )
    op.execute(
        """UPDATE quiz_policies
           SET max_attempts = NULL, cooldown_minutes = 0
           WHERE lesson_id NOT LIKE 'labtest-%'
             AND max_attempts = 3
             AND cooldown_minutes = 0"""
    )
    op.execute(
        """UPDATE quiz_policies
           SET max_attempts = 5, cooldown_minutes = 30
           WHERE lesson_id LIKE 'labtest-%'
             AND max_attempts = 3
             AND cooldown_minutes = 0"""
    )


def downgrade():
    op.execute("UPDATE quiz_policies SET max_attempts = 3 WHERE max_attempts IS NULL")
    op.execute(
        """UPDATE quiz_policies
           SET max_attempts = 3
           WHERE lesson_id LIKE 'labtest-%'
             AND max_attempts = 5
             AND cooldown_minutes = 30"""
    )
    op.execute("ALTER TABLE quiz_policies DROP CONSTRAINT IF EXISTS ck_quiz_policy")
    op.execute(
        """ALTER TABLE quiz_policies ADD CONSTRAINT ck_quiz_policy CHECK (
            num_questions BETWEEN 1 AND 200
            AND pass_score BETWEEN 1 AND 200
            AND time_limit_minutes BETWEEN 1 AND 180
            AND max_attempts BETWEEN 1 AND 100
        )"""
    )
    op.execute("ALTER TABLE quiz_policies ALTER COLUMN max_attempts SET DEFAULT 3")
    op.execute("ALTER TABLE quiz_policies ALTER COLUMN max_attempts SET NOT NULL")
    op.execute("ALTER TABLE quiz_policies DROP COLUMN IF EXISTS cooldown_minutes")
