"""Enforce case-insensitive user email uniqueness without merging accounts."""

import sqlalchemy as sa

from alembic import op

revision = "0004_auth_email"
down_revision = "0003_constraints"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    duplicates = bind.execute(
        sa.text("""
        SELECT 1 FROM users GROUP BY lower(trim(email)) HAVING count(*) > 1 LIMIT 1
    """)
    ).first()
    if duplicates:
        raise RuntimeError(
            "Duplicate normalized user emails exist; resolve account ownership before migrating."
        )
    op.execute("UPDATE users SET email = lower(trim(email)) WHERE email <> lower(trim(email))")
    op.create_index("uq_users_email_normalized", "users", [sa.text("lower(email)")], unique=True)


def downgrade():
    op.drop_index("uq_users_email_normalized", table_name="users")
