"""Align existing and fresh schemas with the shared ORM metadata."""

import sqlalchemy as sa

from alembic import op

revision = "0002_platform_schema"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    additions = {
        "devices": [sa.Column("device_type", sa.Text(), nullable=False, server_default="hardware")],
        "mqtt_credentials": [sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True)],
        "commands": [
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        ],
    }
    for table, columns in additions.items():
        existing = {c["name"] for c in inspector.get_columns(table)}
        for column in columns:
            if column.name not in existing:
                op.add_column(table, column)

    if not inspector.has_table("google_identities"):
        op.create_table(
            "google_identities",
            sa.Column("subject", sa.Text(), primary_key=True),
            sa.Column(
                "user_id",
                sa.BigInteger(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
                unique=True,
            ),
        )
    if not inspector.has_table("auth_revoked_tokens"):
        op.create_table(
            "auth_revoked_tokens",
            sa.Column("token_hash", sa.Text(), primary_key=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_auth_revoked_tokens_expires_at", "auth_revoked_tokens", ["expires_at"])

    if not any(
        fk["constrained_columns"] == ["device_id"] and fk["referred_table"] == "devices"
        for fk in inspector.get_foreign_keys("telemetry")
    ):
        op.create_foreign_key(
            "fk_telemetry_device_id_devices",
            "telemetry",
            "devices",
            ["device_id"],
            ["id"],
            ondelete="CASCADE",
        )

    partitioned = bind.execute(
        sa.text("SELECT 1 FROM pg_partitioned_table WHERE partrelid='telemetry'::regclass")
    ).scalar()
    if partitioned:
        has_default = bind.execute(
            sa.text("""
            SELECT 1 FROM pg_inherits i JOIN pg_class c ON c.oid=i.inhrelid
            WHERE i.inhparent='telemetry'::regclass AND pg_get_expr(c.relpartbound,c.oid)='DEFAULT'
        """)
        ).scalar()
        if not has_default:
            op.execute("CREATE TABLE telemetry_default PARTITION OF telemetry DEFAULT")


def downgrade():
    raise RuntimeError(
        "This data-preserving adoption is forward-only; restore a backup to roll back."
    )
