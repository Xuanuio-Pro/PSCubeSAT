"""Legacy data rehearsal for the pilot release (plan section 10).

Usage (run against a COPY of the database first):
  python -m app.services.legacy_migration report [--pilot pilot.json] [--out report.json]
  python -m app.services.legacy_migration import-pilot --pilot pilot.json [--apply]
  python -m app.services.legacy_migration compare --source URL --restored URL

`report` and `import-pilot` without --apply run in a read-only transaction and change nothing.
Users are never assigned to a class automatically: only emails listed in the pilot file.
Legacy lab_progress (including compiled_at) stays as-is and never becomes LMS completion.
"""

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from loguru import logger
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from sqlalchemy import func, inspect, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.database import _normalize_database_url, get_session_maker
from app.models.curriculum import CourseVersion, Lesson
from app.models.tables import (
    AccountStatus,
    ClassMembership,
    Classroom,
    LabProgress,
    MembershipRole,
    MembershipStatus,
    User,
    UserRole,
)
from app.schemas.classes import ClassCreate
from app.services.classes import add_student, create_class
from app.services.curriculum_seed import read_seed
from app.services.permissions import ClassAccess

COUNTED_TABLES = (
    "users",
    "lab_progress",
    "classes",
    "class_memberships",
    "lesson_progress",
    "progress_events",
    "completion_overrides",
    "practice_submissions",
    "question_versions",
    "quiz_attempts",
    "quiz_answers",
    "audit_logs",
)
LEGACY_POLICY = (
    "lab_progress được giữ nguyên làm lịch sử legacy; compiled_at/completed_at không được "
    "chuyển thành hoàn thành trong lớp. GV công nhận tương đương bằng miễn bài (waive) có lý do."
)


class PilotClass(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str
    name: str
    term: str | None = None
    description: str | None = None
    status: str = "active"


class PilotSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    actor_email: EmailStr
    teacher_email: EmailStr
    class_: PilotClass = Field(alias="class")
    student_emails: list[EmailStr] = Field(min_length=1, max_length=2000)

    @field_validator("actor_email", "teacher_email", mode="before")
    @classmethod
    def normalize(cls, value):
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("student_emails", mode="before")
    @classmethod
    def normalize_list(cls, value):
        return [v.strip().lower() for v in value] if isinstance(value, list) else value


async def read_only(db):
    if db.bind.dialect.name == "postgresql":
        await db.execute(text("SET TRANSACTION READ ONLY"))


async def alembic_revision(db):
    conn = await db.connection()
    exists = await conn.run_sync(lambda sync: inspect(sync).has_table("alembic_version"))
    if not exists:
        return None
    return (await db.execute(text("SELECT version_num FROM alembic_version"))).scalar_one_or_none()


async def user_by_email(db, email):
    return (
        await db.execute(
            select(User).where(func.lower(User.email) == email, User.deleted_at.is_(None))
        )
    ).scalar_one_or_none()


async def legacy_labs(db, user_ids):
    rows = await db.execute(
        select(LabProgress.user_id, LabProgress.lab_id)
        .where(LabProgress.user_id.in_(user_ids), LabProgress.compiled_at.is_not(None))
        .order_by(LabProgress.lab_id)
    )
    labs = {}
    for user_id, lab_id in rows.all():
        labs.setdefault(user_id, []).append(lab_id)
    return labs


async def plan_pilot(db, spec):
    """Validate the pilot list without writing. Returns plan, errors, actor, teacher, class."""
    errors = []
    actor = await user_by_email(db, spec.actor_email)
    if not actor or actor.role != UserRole.admin or actor.status != AccountStatus.active:
        errors.append({"field": "actor_email", "code": "ACTOR_NOT_ADMIN"})
    teacher = await user_by_email(db, spec.teacher_email)
    if not teacher or teacher.role != UserRole.teacher or teacher.status != AccountStatus.active:
        errors.append({"field": "teacher_email", "code": "TEACHER_NOT_ACTIVE"})
    code = spec.class_.code.strip().upper()
    existing = (
        await db.execute(select(Classroom).where(Classroom.code == code))
    ).scalar_one_or_none()
    if existing and teacher:
        owner = (
            await db.execute(
                select(ClassMembership.id).where(
                    ClassMembership.class_id == existing.id,
                    ClassMembership.user_id == teacher.id,
                    ClassMembership.role == MembershipRole.teacher,
                )
            )
        ).scalar_one_or_none()
        if owner is None:
            errors.append({"field": "class.code", "code": "CLASS_CODE_TAKEN"})
    duplicates = sorted({e for e in spec.student_emails if spec.student_emails.count(e) > 1})
    if duplicates:
        errors.append({"field": "student_emails", "code": "DUPLICATE_EMAIL", "emails": duplicates})
    students = []
    for email in dict.fromkeys(spec.student_emails):
        user = await user_by_email(db, email)
        entry = {"email": email, "user_id": user.id if user else None, "action": None}
        if user is None:
            entry["problem"] = "NOT_REGISTERED"
        elif user.status != AccountStatus.active:
            entry["problem"] = "ACCOUNT_LOCKED"
        elif teacher and user.id == teacher.id:
            entry["problem"] = "IS_CLASS_TEACHER"
        else:
            membership = None
            if existing:
                membership = (
                    await db.execute(
                        select(ClassMembership).where(
                            ClassMembership.class_id == existing.id,
                            ClassMembership.user_id == user.id,
                        )
                    )
                ).scalar_one_or_none()
            if membership and membership.role != MembershipRole.student:
                entry["problem"] = "IS_CLASS_TEACHER"
            else:
                entry["action"] = (
                    "add"
                    if membership is None
                    else "keep"
                    if membership.status == MembershipStatus.active
                    else "restore"
                )
        students.append(entry)
    found = [s["user_id"] for s in students if s["user_id"]]
    history = await legacy_labs(db, found) if found else {}
    for entry in students:
        entry["legacy_compiled_labs"] = history.get(entry["user_id"], [])
    problems = [s for s in students if s.get("problem")]
    if problems:
        errors.append(
            {"field": "student_emails", "code": "STUDENT_INVALID", "count": len(problems)}
        )
    plan = {
        "class": {
            "code": code,
            "exists": existing is not None,
            "id": existing.id if existing else None,
        },
        "students": students,
        "legacy_policy": LEGACY_POLICY,
    }
    return plan, errors, actor, teacher, existing


async def mapping_report(db, spec=None):
    await read_only(db)
    users = {
        "total": (
            await db.execute(
                select(func.count()).select_from(User).where(User.deleted_at.is_(None))
            )
        ).scalar_one(),
        "by_role": {},
    }
    for role, status, count in (
        await db.execute(
            select(User.role, User.status, func.count())
            .where(User.deleted_at.is_(None))
            .group_by(User.role, User.status)
        )
    ).all():
        users["by_role"].setdefault(role.value, {})[status.value] = count
    by_lab = {}
    for lab_id, rows, video, doc, compiled, completed in (
        await db.execute(
            select(
                LabProgress.lab_id,
                func.count(),
                func.count().filter(LabProgress.video_watched.is_(True)),
                func.count().filter(LabProgress.doc_viewed.is_(True)),
                func.count(LabProgress.compiled_at),
                func.count(LabProgress.completed_at),
            ).group_by(LabProgress.lab_id)
        )
    ).all():
        by_lab[str(lab_id)] = {
            "rows": rows,
            "video_watched": video,
            "doc_viewed": doc,
            "compiled": compiled,
            "completed": completed,
        }
    version = (
        await db.execute(
            select(CourseVersion)
            .where(CourseVersion.status == "published")
            .order_by(CourseVersion.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    lesson_ids = set()
    if version:
        lesson_ids = set(
            (
                await db.execute(select(Lesson.id).where(Lesson.course_version_id == version.id))
            ).scalars()
        )
    legacy_ids = [item["id"] for lab in read_seed()["legacy"] for item in lab["lessons"]]
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "database": {
            "dialect": db.bind.dialect.name,
            "alembic_revision": await alembic_revision(db),
        },
        "users": users,
        "lab_progress": {
            "rows": sum(lab["rows"] for lab in by_lab.values()),
            "users": (
                await db.execute(select(func.count(func.distinct(LabProgress.user_id))))
            ).scalar_one(),
            "by_lab": by_lab,
            "unknown_lab_ids": sorted(int(lab) for lab in by_lab if not 0 <= int(lab) <= 8),
            "policy": LEGACY_POLICY,
        },
        "lesson_ids": {
            "course_version_id": version.id if version else None,
            "legacy_total": len(legacy_ids),
            "mapped": sum(item in lesson_ids for item in legacy_ids),
            "missing": [item for item in legacy_ids if item not in lesson_ids],
        },
        "classes": {
            "total": (await db.execute(select(func.count()).select_from(Classroom))).scalar_one()
        },
    }
    if spec:
        plan, errors, *_ = await plan_pilot(db, spec)
        report["pilot"] = {**plan, "errors": errors}
    await db.rollback()
    return report


async def import_pilot(db, spec, *, apply=False):
    if not apply:
        await read_only(db)
    plan, errors, actor, teacher, existing = await plan_pilot(db, spec)
    if errors or not apply:
        await db.rollback()
        return {"applied": False, "errors": errors, **plan}
    logger.bind(
        action="pilot_import_started",
        class_code=plan["class"]["code"],
        student_count=len(plan["students"]),
    ).info("Pilot import started")
    if existing is None:
        created = await create_class(
            db,
            actor,
            ClassCreate(**spec.class_.model_dump(), teacher_id=teacher.id),
        )
        existing = await db.get(Classroom, created.id)
    access = ClassAccess(existing, actor, None)
    for entry in plan["students"]:
        # Same service as the teacher UI: one membership per user, audit, restore semantics.
        await add_student(db, access, entry["email"])
    logger.bind(
        action="pilot_import_finished", class_id=existing.id, student_count=len(plan["students"])
    ).info("Pilot import finished")
    plan["class"].update(id=existing.id, exists=True)
    return {"applied": True, "errors": [], **plan}


async def table_counts(db):
    await read_only(db)
    conn = await db.connection()
    names = set(await conn.run_sync(lambda sync: inspect(sync).get_table_names()))
    counts = {}
    for name in COUNTED_TABLES:
        if name in names:
            counts[name] = (await db.execute(text(f"SELECT count(*) FROM {name}"))).scalar_one()
    await db.rollback()
    return counts


async def compare(source_url, restored_url):
    result = {}
    for label, url in (("source", source_url), ("restored", restored_url)):
        engine = create_async_engine(_normalize_database_url(url))
        try:
            async with async_sessionmaker(engine)() as db:
                result[label] = await table_counts(db)
        finally:
            await engine.dispose()
    diff = {
        name: {"source": result["source"].get(name), "restored": result["restored"].get(name)}
        for name in COUNTED_TABLES
        if result["source"].get(name) != result["restored"].get(name)
    }
    return {"matches": not diff, "differences": diff, **result}


def load_spec(path):
    return PilotSpec.model_validate(json.loads(Path(path).read_text(encoding="utf-8")))


async def main(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    sub = parser.add_subparsers(dest="command", required=True)
    report = sub.add_parser("report")
    report.add_argument("--pilot")
    report.add_argument("--out", type=Path)
    pilot = sub.add_parser("import-pilot")
    pilot.add_argument("--pilot", required=True)
    pilot.add_argument("--apply", action="store_true")
    pilot.add_argument("--out", type=Path)
    check = sub.add_parser("compare")
    check.add_argument("--source", required=True)
    check.add_argument("--restored", required=True)
    args = parser.parse_args(argv)
    if args.command == "compare":
        output = await compare(args.source, args.restored)
        code = 0 if output["matches"] else 1
    else:
        spec = load_spec(args.pilot) if args.pilot else None
        async with get_session_maker()() as db:
            if args.command == "report":
                output = await mapping_report(db, spec)
                code = 0
            else:
                output = await import_pilot(db, spec, apply=args.apply)
                code = 1 if output["errors"] else 0
    text_output = json.dumps(output, ensure_ascii=False, indent=2, default=str)
    if getattr(args, "out", None):
        args.out.write_text(text_output + "\n", encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    print(text_output)
    return code


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
