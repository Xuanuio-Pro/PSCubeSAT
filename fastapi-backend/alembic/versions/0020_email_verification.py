"""Add email verification: users.email_verified_at and email_verification_tokens.

Every account that exists when this runs is marked verified (email_verified_at = created_at), so
nobody is locked out. New sign-ups are verified through a single-use emailed link when SMTP is
configured; without SMTP they are marked verified at registration.

Downgrade drops the column and the token table. That only discards the verification state added
by this revision (no learning, progress or account data), and re-upgrading backfills every
existing account as verified again.
"""

from alembic import op

revision = "0020_email_verification"
down_revision = "0019_merge_reset_and_quiz"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ")
    op.execute("UPDATE users SET email_verified_at = COALESCE(created_at, now()) WHERE email_verified_at IS NULL")
    op.execute("""CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )""")
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_email_verification_user "
        "ON email_verification_tokens(user_id)"
    )


def downgrade():
    op.execute("DROP TABLE IF EXISTS email_verification_tokens")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at")
