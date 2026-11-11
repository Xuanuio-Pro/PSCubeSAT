"""Rename legacy lesson ids in lab_progress after the Lab1/3/4/6/7 curriculum restructure.

Scheduler/Watchdog moved from Lab6 to Lab3, Camera Multiplexer from Lab7 to Lab4,
Lab1 gained four GPIO exercises. Published class snapshots are immutable and are not touched.
Lab-level completed_at, compiled_at and the other flags are preserved as they are.
"""

import re

import sqlalchemy as sa

from alembic import op

revision = "0013_curriculum_restructure"
down_revision = "0012_merge_0011_heads"
branch_labels = None
depends_on = None

RENAMES = {
    "Lab1-02_Serial_Communication": "Lab1-06_Serial_Communication",
    "Lab1-03_Serial_Control_LED": "Lab1-07_Serial_Control_LED",
    "Lab1-04_WiFi_Connection": "Lab1-08_WiFi_Connection",
    "Lab1-05_WiFi_AP_Mode": "Lab1-09_WiFi_AP_Mode",
    "Lab1-06_Web_Server_LED": "Lab1-10_Web_Server_LED",
    "video-1-3": "video-1-4",
    "document-1-3": "document-1-4",
    "Lab2-01a_Battery_GPIO": "Lab2-01a_Battery_I2C",
    "Lab6-01_Multitasking_Scheduler": "Lab3-03_Multitasking_Scheduler",
    "Lab6-02_Watchdog_And_Event": "Lab3-04_Watchdog_And_Event",
    "video-6-3": "video-3-3",
    "document-6-2": "document-3-2",
    "document-6-3": "document-3-3",
    "video-6-4": "video-3-4",
    "document-6-4": "document-3-4",
    "document-7-1": "document-4-3",
    "Lab7-01_Camera_Multiplexer": "Lab4-06_Camera_Multiplexer",
    "Lab7-02_Full_Satellite_Program": "Lab7-01_Full_Satellite_Program",
    "Lab7-03_RTOS_Satellite_System": "Lab7-02_RTOS_Satellite_System",
}


def lab_of(lesson_id: str) -> int:
    match = re.match(r"^Lab(\d)-|^(?:video|document)-(\d)-", lesson_id)
    return int(match.group(1) or match.group(2))


def rename_lessons(renames: dict[str, str]) -> None:
    """Move each lesson entry to its new id and, when the lab changes, to the user's new lab row.

    Applied one rename at a time in a fixed order; ids never collide because targets are unused.
    """
    bind = op.get_bind()
    for old, new in renames.items():
        old_lab, new_lab = lab_of(old), lab_of(new)
        params = {"old": old, "new": new, "old_lab": old_lab, "new_lab": new_lab}
        if old_lab == new_lab:
            bind.execute(
                sa.text(
                    "UPDATE lab_progress SET lesson_progress = "
                    "(lesson_progress - :old) || jsonb_build_object(CAST(:new AS text), lesson_progress -> :old) "
                    "WHERE lab_id = :old_lab AND jsonb_exists(lesson_progress, :old)"
                ),
                params,
            )
            continue
        bind.execute(
            sa.text(
                "INSERT INTO lab_progress (user_id, lab_id, lesson_progress) "
                "SELECT user_id, :new_lab, jsonb_build_object(CAST(:new AS text), lesson_progress -> :old) "
                "FROM lab_progress WHERE lab_id = :old_lab AND jsonb_exists(lesson_progress, :old) "
                "ON CONFLICT (user_id, lab_id) DO UPDATE "
                "SET lesson_progress = lab_progress.lesson_progress || EXCLUDED.lesson_progress"
            ),
            params,
        )
        bind.execute(
            sa.text(
                "UPDATE lab_progress SET lesson_progress = lesson_progress - :old "
                "WHERE lab_id = :old_lab AND jsonb_exists(lesson_progress, :old)"
            ),
            params,
        )


def upgrade():
    rename_lessons(RENAMES)


def downgrade():
    # Lessons that exist only in the new curriculum keep their data under their new ids.
    # Exception: the new GPIO video-1-3/document-1-3 slots are overwritten by the legacy WiFi lessons.
    rename_lessons({new: old for old, new in RENAMES.items()})
