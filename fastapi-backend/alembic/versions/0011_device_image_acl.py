"""Allow existing devices to publish camera JPEGs on sensors/<uid>/image.

New devices get this rule at registration. Downgrade removes only the rules added here.
"""

from alembic import op

revision = "0011_device_image_acl"
down_revision = "0010_class_lms_mode"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        INSERT INTO mqtt_acl (device_id, permission, action, topic)
        SELECT d.id, 'allow', 'publish', 'sensors/' || d.device_uid || '/image'
        FROM devices d
        JOIN mqtt_credentials c ON c.device_id = d.id
        WHERE d.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM mqtt_acl a
            WHERE a.device_id = d.id AND a.topic = 'sensors/' || d.device_uid || '/image'
          )
        """
    )


def downgrade():
    op.execute("DELETE FROM mqtt_acl WHERE action = 'publish' AND topic LIKE 'sensors/%/image'")
