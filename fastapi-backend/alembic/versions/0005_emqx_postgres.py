"""Expose active device credentials and scoped ACLs to EMQX PostgreSQL backends."""
from alembic import op
import sqlalchemy as sa

revision = '0005_emqx_postgres'
down_revision = '0004_auth_email'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('mqtt_credentials', sa.Column('rotated_at', sa.DateTime(timezone=True)))
    op.add_column('mqtt_credentials', sa.Column('revoked_at', sa.DateTime(timezone=True)))
    # Keep existing usernames/passwords/ACLs unchanged: deployed firmware may use them.
    op.execute('''CREATE VIEW emqx_mqtt_authn AS
        SELECT c.username, c.password_hash, FALSE AS is_superuser
        FROM mqtt_credentials c
        JOIN devices d ON d.id = c.device_id
        JOIN users u ON u.id = d.user_id
        WHERE c.enabled AND c.deleted_at IS NULL AND c.revoked_at IS NULL
          AND d.enabled AND d.deleted_at IS NULL AND u.deleted_at IS NULL''')
    op.execute('''CREATE VIEW emqx_mqtt_authz AS
        SELECT c.username, a.permission::text AS permission, a.action::text AS action, a.topic,
               CASE WHEN a.permission::text = 'deny' THEN 100 ELSE 50 END AS priority
        FROM mqtt_credentials c
        JOIN devices d ON d.id = c.device_id
        JOIN users u ON u.id = d.user_id
        JOIN mqtt_acl a ON a.device_id = d.id
        WHERE c.enabled AND c.deleted_at IS NULL AND c.revoked_at IS NULL
          AND d.enabled AND d.deleted_at IS NULL AND u.deleted_at IS NULL
        UNION ALL
        SELECT c.username, 'deny', 'all', '#', 0 FROM mqtt_credentials c''')
    op.execute('REVOKE ALL ON emqx_mqtt_authn, emqx_mqtt_authz FROM PUBLIC')


def downgrade():
    op.execute('DROP VIEW emqx_mqtt_authz')
    op.execute('DROP VIEW emqx_mqtt_authn')
    op.drop_column('mqtt_credentials', 'revoked_at')
    op.drop_column('mqtt_credentials', 'rotated_at')
