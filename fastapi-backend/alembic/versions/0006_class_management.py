"""Add class management without rewriting existing users or progress.

Downgrade retains additive schema/data intentionally. Disable LMS_CLASS_MODE
to roll back functionality; do not run an old binary that cannot read teacher.
Re-upgrade is idempotent so a revision rollback never destroys new records.
"""

from alembic import op

revision = "0006_class_management"
down_revision = "0005_emqx_postgres"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'teacher'")
    for name, values in {
        "account_status": "'active', 'locked'",
        "class_status": "'draft', 'active', 'archived'",
        "membership_role": "'teacher', 'student'",
        "membership_status": "'active', 'removed'",
    }.items():
        op.execute(f"""DO $$ BEGIN
            CREATE TYPE {name} AS ENUM ({values});
        EXCEPTION WHEN duplicate_object THEN NULL; END $$""")
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS status account_status NOT NULL DEFAULT 'active'"
    )
    op.execute("""CREATE TABLE IF NOT EXISTS classes (
        id BIGSERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
        description TEXT, term TEXT, status class_status NOT NULL DEFAULT 'draft',
        created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )""")
    op.execute("""CREATE TABLE IF NOT EXISTS class_memberships (
        id BIGSERIAL PRIMARY KEY,
        class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        role membership_role NOT NULL,
        status membership_status NOT NULL DEFAULT 'active',
        added_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        added_at TIMESTAMPTZ NOT NULL DEFAULT now(), removed_at TIMESTAMPTZ,
        CONSTRAINT uq_class_membership UNIQUE(class_id, user_id)
    )""")
    op.execute("CREATE INDEX IF NOT EXISTS idx_membership_user ON class_memberships(user_id)")
    op.execute("""CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY, actor BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        action TEXT NOT NULL, target TEXT NOT NULL, before JSONB, after JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )""")


def downgrade():
    # Removing a role, account lock, membership or audit log would lose data and
    # could restore access inadvertently. Retain schema as documented above.
    pass
