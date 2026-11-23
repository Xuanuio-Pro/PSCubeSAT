"""Align 12 practice lesson ids in lab_progress with README names.

Published class snapshots (`class_lesson_settings`, `lesson_progress`) are immutable and preserved
under their historical course_version_id; upgrading a class carries settings and progress forward
via `course_configuration.PRACTICE_ID_RENAMES`.
"""

import re

import sqlalchemy as sa

from alembic import op

revision = "0023_readme_id_alignment"
down_revision = "0022_quiz_attempts_and_cooldown"
branch_labels = None
depends_on = None

RENAMES = {
    "Lab1-03_Button": "Lab1-04_Button",
    "Lab1-04_LED_Button": "Lab1-05_LED_Button",
    "Lab1-05_7_Segment_LED": "Lab1-06_7_Segment_LED",
    "Lab1-06_Serial_Communication": "Lab1-07_Serial_Communication",
    "Lab1-07_Serial_Control_LED": "Lab1-08_Serial_Control_LED",
    "Lab1-08_WiFi_Connection": "Lab1-09_WiFi_Connection",
    "Lab1-09_WiFi_AP_Mode": "Lab1-10_WiFi_AP_Mode",
    "Lab1-10_Web_Server_LED": "Lab1-11_Web_Server_LED",
    "Lab3-04_Watchdog_And_Event": "Lab3-04_Watchdog_Timer",
    "Lab4-06_Camera_Multiplexer": "Lab4-05_Camera_Multiplexer",
    "Lab4-05_Read_All_Sensors": "Lab4-06_Read_All_Sensors",
    "Lab5-03_Satellite_Comm_System": "Lab5-03_Ground_Station_Demo",
}

# Process Lab 1 descending during upgrade so target keys never collide with source keys in the same row,
# and reverse that order during downgrade.
ORDERED_KEYS = [
    "Lab1-10_Web_Server_LED",
    "Lab1-09_WiFi_AP_Mode",
    "Lab1-08_WiFi_Connection",
    "Lab1-07_Serial_Control_LED",
    "Lab1-06_Serial_Communication",
    "Lab1-05_7_Segment_LED",
    "Lab1-04_LED_Button",
    "Lab1-03_Button",
    "Lab3-04_Watchdog_And_Event",
    "Lab4-06_Camera_Multiplexer",
    "Lab4-05_Read_All_Sensors",
    "Lab5-03_Satellite_Comm_System",
]


def lab_of(lesson_id: str) -> int:
    match = re.match(r"^Lab(\d+)-", lesson_id)
    assert match is not None, f"Unexpected practice lesson id: {lesson_id}"
    return int(match.group(1))


def rename_lessons(pairs: list[tuple[str, str]]) -> None:
    """Rename lesson entries inside each user's lab_progress JSONB for the same lab."""
    bind = op.get_bind()
    for old, new in pairs:
        params = {"old": old, "new": new, "lab_id": lab_of(old)}
        # If both old and new already exist in the JSONB, keep the new entry unless old has completed=true.
        bind.execute(
            sa.text(
                "UPDATE lab_progress SET lesson_progress = "
                "(lesson_progress - :old) || jsonb_build_object("
                "  CAST(:new AS text),"
                "  CASE"
                "    WHEN jsonb_exists(lesson_progress, :new)"
                "      AND COALESCE((lesson_progress -> :new ->> 'completed')::boolean, false)"
                "      THEN lesson_progress -> :new"
                "    ELSE lesson_progress -> :old"
                "  END"
                ") "
                "WHERE lab_id = :lab_id AND jsonb_exists(lesson_progress, :old)"
            ),
            params,
        )


def upgrade():
    rename_lessons([(old, RENAMES[old]) for old in ORDERED_KEYS])


def downgrade():
    rename_lessons([(RENAMES[old], old) for old in reversed(ORDERED_KEYS)])
