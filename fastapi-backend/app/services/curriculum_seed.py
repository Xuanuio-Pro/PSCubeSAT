"""Idempotent import of the checked-in, Node-exported JS curriculum snapshot."""

import argparse
import asyncio
import json
from collections import Counter
from pathlib import Path

from sqlalchemy import func, select, text

from app.db.database import get_session_maker
from app.models.curriculum import Course, CourseVersion, Lab, Lesson

SEED_PATH = Path(__file__).resolve().parents[1] / "firmware/curriculum/seed.json"


def read_seed():
    return json.loads(SEED_PATH.read_text(encoding="utf-8"))


async def seed_curriculum(db):
    data = read_seed()
    version_id = f"{data['course_id']}-{data['source_hash'][:16]}"
    if db.bind.dialect.name == "postgresql":
        await db.execute(text("SELECT pg_advisory_xact_lock(74372691)"))
    existing = await db.get(CourseVersion, version_id)
    if existing:
        if existing.source_hash != data["source_hash"] or existing.status != "published":
            raise ValueError("Seed version conflict; never overwrite a published snapshot.")
    else:
        if not await db.get(Course, data["course_id"]):
            db.add(Course(id=data["course_id"], title=data["course_title"]))
            await db.flush()
        version = (
            await db.execute(
                select(func.max(CourseVersion.version)).where(
                    CourseVersion.course_id == data["course_id"]
                )
            )
        ).scalar_one() or 0
        row = CourseVersion(
            id=version_id,
            course_id=data["course_id"],
            version=version + 1,
            status="draft",
            source_hash=data["source_hash"],
        )
        db.add(row)
        await db.flush()
        for item in data["labs"]:
            db.add(
                Lab(
                    course_version_id=version_id,
                    **{k: v for k, v in item.items() if k != "lessons"},
                )
            )
        await db.flush()
        for lab in data["labs"]:
            for item in lab["lessons"]:
                db.add(
                    Lesson(
                        course_version_id=version_id,
                        **{k: v for k, v in item.items() if not k.startswith("default_")},
                    )
                )
        await db.flush()
        row.status = "published"
        await db.flush()
    report = {
        "course_version_id": version_id,
        "labs": [
            {
                "lab_id": lab["id"],
                "total": len(lab["lessons"]),
                "types": dict(Counter(item["type"] for item in lab["lessons"])),
            }
            for lab in data["labs"]
        ],
    }
    return report


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    async with get_session_maker()() as db:
        report = await seed_curriculum(db)
        await db.commit()
    output = json.dumps(report, ensure_ascii=False, indent=2)
    if args.report:
        args.report.write_text(output + "\n", encoding="utf-8")
    print(output)


if __name__ == "__main__":
    asyncio.run(main())
