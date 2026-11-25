"""Backfill empty draft question banks with approved sample questions.

Existing classes with untouched empty draft banks receive the default 3 rotating
sample questions (for `quiz`) or 10 sample questions (for `labtest`) marked as
`approved`, while keeping each bank in `draft` status so teachers can add or
remove questions before publishing. Untouched default `labtest-*` policies are
updated from (5 questions, pass 4, 10 min) to (10 questions, pass 8, 15 min).

Non-empty banks, published banks, customized policies, and `class_lesson_settings`
are left untouched.

Downgrade intentionally preserves all seeded questions so authoring work is never
discarded, and reverts only untouched default `labtest-*` policy values back to
(5, 4, 10) so rolling back past `0017_quiz_all_approved` stays clean; re-running
upgrade is idempotent.
"""

from datetime import datetime, timezone
from uuid import uuid4

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op
from app.services.sample_questions import default_policy, sample_questions_for

revision = "0021_default_sample_quiz_banks"
down_revision = "0020_email_verification"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    empty_banks = bind.execute(
        sa.text(
            """SELECT qb.id, qb.course_version_id, qb.lab_id, qb.lesson_id, qb.created_by
               FROM question_banks qb
               WHERE qb.status = 'draft'
                 AND NOT EXISTS (
                     SELECT 1 FROM question_versions qv WHERE qv.bank_id = qb.id
                 )
               ORDER BY qb.class_id, qb.lab_id, qb.lesson_id"""
        )
    ).all()

    if empty_banks:
        question_versions_table = sa.table(
            "question_versions",
            sa.column("id", sa.Text),
            sa.column("bank_id", sa.Text),
            sa.column("question_id", sa.Text),
            sa.column("content", sa.JSON().with_variant(postgresql.JSONB(), "postgresql")),
            sa.column("status", sa.Text),
            sa.column("reviewer", sa.BigInteger),
            sa.column("reviewed_at", sa.DateTime(timezone=True)),
        )

        quiz_index_cache: dict[tuple[str, int], dict[str, int]] = {}
        now = datetime.now(timezone.utc)
        to_insert: list[dict] = []

        for bank_id, course_version_id, lab_id, lesson_id, created_by in empty_banks:
            cache_key = (course_version_id, lab_id)
            if cache_key not in quiz_index_cache:
                lesson_rows = bind.execute(
                    sa.text(
                        """SELECT id FROM lessons
                           WHERE course_version_id = :cv AND lab_id = :lab AND type = 'quiz'
                           ORDER BY order_no, id"""
                    ),
                    {"cv": course_version_id, "lab": lab_id},
                ).all()
                quiz_index_cache[cache_key] = {row[0]: idx for idx, row in enumerate(lesson_rows)}
            quiz_index = quiz_index_cache[cache_key].get(lesson_id, 0)
            samples = sample_questions_for(lab_id, lesson_id, quiz_index=quiz_index)
            for sample in samples:
                to_insert.append(
                    {
                        "id": str(uuid4()),
                        "bank_id": bank_id,
                        "question_id": str(uuid4()),
                        "content": sample,
                        "status": "approved",
                        "reviewer": created_by,
                        "reviewed_at": now,
                    }
                )

        if to_insert:
            bind.execute(question_versions_table.insert(), to_insert)

    labtest_policy = default_policy("labtest")
    bind.execute(
        sa.text(
            """UPDATE quiz_policies
               SET num_questions = :num_questions,
                   pass_score = :pass_score,
                   time_limit_minutes = :time_limit_minutes
               WHERE lesson_id LIKE 'labtest-%'
                 AND revision = 1
                 AND bank_id IS NULL
                 AND num_questions = 5
                 AND pass_score = 4
                 AND time_limit_minutes = 10
                 AND EXISTS (
                     SELECT 1
                     FROM question_banks qb
                     WHERE qb.class_id = quiz_policies.class_id
                       AND qb.lesson_id = quiz_policies.lesson_id
                       AND qb.status = 'draft'
                       AND (
                           SELECT COUNT(*)
                           FROM question_versions qv
                           WHERE qv.bank_id = qb.id
                             AND qv.status = 'approved'
                       ) >= 8
                 )"""
        ),
        {
            "num_questions": labtest_policy["num_questions"],
            "pass_score": labtest_policy["pass_score"],
            "time_limit_minutes": labtest_policy["time_limit_minutes"],
        },
    )


def downgrade():
    # Preserve seeded/edited question bank data; only revert untouched default
    # labtest-* policies so pre-0017 constraints hold on rollback.
    bind = op.get_bind()
    labtest_policy = default_policy("labtest")
    bind.execute(
        sa.text(
            """UPDATE quiz_policies
               SET num_questions = 5,
                   pass_score = 4,
                   time_limit_minutes = 10
               WHERE lesson_id LIKE 'labtest-%'
                 AND revision = 1
                 AND bank_id IS NULL
                 AND (
                     (num_questions = 10 AND pass_score = 8 AND time_limit_minutes = 15)
                     OR (
                         num_questions = :num_questions
                         AND pass_score = :pass_score
                         AND time_limit_minutes = :time_limit_minutes
                     )
                 )"""
        ),
        {
            "num_questions": labtest_policy["num_questions"],
            "pass_score": labtest_policy["pass_score"],
            "time_limit_minutes": labtest_policy["time_limit_minutes"],
        },
    )
