"""Read-only aggregates for class reports and the Admin dashboard. Nothing here writes."""

import csv
import io
from datetime import datetime, timedelta, timezone

from loguru import logger
from sqlalchemy import func, select, union_all

from app.core.lms_errors import LMSError
from app.models.learning import ProgressEvent
from app.models.quiz import QuizAttempt
from app.models.tables import (
    AccountStatus,
    ClassMembership,
    Classroom,
    ClassStatus,
    LabProgress,
    MembershipRole,
    MembershipStatus,
    User,
)
from app.services.learning_progress import (
    class_members,
    member_paths,
    pending_submissions,
    raw_config,
)
from app.services.permissions import ClassAccess

# Teacher overrides are not learner activity; every other progress event is.
TEACHER_EVENT_KINDS = ("override",)
ACTIVITY_DEFINITION = (
    "SV hoạt động = có sự kiện học (mở/đọc/xem bài, nộp thực hành, chấm Lab Test) "
    "hoặc bắt đầu lượt Lab Test trong khoảng thời gian; đăng nhập không được tính."
)


def iso(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


async def last_activity(db, member_ids):
    if not member_ids:
        return {}
    events = select(
        ProgressEvent.membership_id.label("member"), ProgressEvent.created_at.label("at")
    ).where(
        ProgressEvent.membership_id.in_(member_ids),
        ProgressEvent.kind.not_in(TEACHER_EVENT_KINDS),
    )
    attempts = select(
        QuizAttempt.membership_id.label("member"), QuizAttempt.started_at.label("at")
    ).where(QuizAttempt.membership_id.in_(member_ids))
    activity = union_all(events, attempts).subquery()
    rows = await db.execute(
        select(activity.c.member, func.max(activity.c.at)).group_by(activity.c.member)
    )
    return {member: at for member, at in rows.all()}


async def attempt_summary(db, class_id):
    rows = await db.execute(
        select(
            QuizAttempt.membership_id,
            QuizAttempt.lab_id,
            func.count(),
            func.max(QuizAttempt.score),
        )
        .where(QuizAttempt.class_id == class_id)
        .group_by(QuizAttempt.membership_id, QuizAttempt.lab_id)
    )
    return {(member, lab): (count, best) for member, lab, count, best in rows.all()}


async def legacy_history(db, user_ids):
    if not user_ids:
        return {}
    rows = await db.execute(
        select(LabProgress.user_id, LabProgress.lab_id)
        .where(LabProgress.user_id.in_(user_ids), LabProgress.compiled_at.is_not(None))
        .order_by(LabProgress.lab_id)
    )
    history = {}
    for user_id, lab_id in rows.all():
        history.setdefault(user_id, []).append(lab_id)
    return history


async def class_report(db, access):
    config = await raw_config(db, access)
    members = await class_members(db, access)
    paths = await member_paths(db, config, [member for member, _ in members])
    attempts = await attempt_summary(db, access.classroom.id)
    activity = await last_activity(db, [member.id for member, _ in members])
    legacy = await legacy_history(db, [user.id for _, user in members])
    pending = {}
    for item in await pending_submissions(db, access):
        pending[item["membership_id"]] = pending.get(item["membership_id"], 0) + 1
    students = []
    for member, user in members:
        path = paths[member.id]
        labs = []
        for lab in path["labs"]:
            count, best = attempts.get((member.id, lab["id"]), (0, None))
            labs.append(
                {
                    "id": lab["id"],
                    "completed": lab["completed"],
                    "percent": lab["percent"],
                    "access": lab["access"],
                    "best_score": best,
                    "attempts": count,
                }
            )
        students.append(
            {
                "membership_id": member.id,
                "user_id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "membership_status": member.status,
                "percent": path["percent"],
                "completed_labs": path["completed_labs"],
                "total_labs": path["total_labs"],
                "attempts_total": sum(lab["attempts"] for lab in labs),
                "pending_reviews": pending.get(member.id, 0),
                "last_activity_at": iso(activity.get(member.id)),
                # Legacy builds are history only; teachers may waive with a reason.
                "legacy_compiled_labs": legacy.get(user.id, []),
                "labs": labs,
            }
        )
    active = [s for s in students if s["membership_status"] == MembershipStatus.active]
    logger.bind(
        action="class_report_built", class_id=access.classroom.id, student_count=len(students)
    ).debug("Class report built")
    return {
        "class_id": access.classroom.id,
        "generated_at": iso(datetime.now(timezone.utc)),
        "summary": {
            "active_students": len(active),
            "average_percent": round(sum(s["percent"] for s in active) / len(active), 2)
            if active
            else 0,
            "pending_reviews": sum(pending.values()),
            "total_labs": sum(lab["enabled"] for lab in config["labs"]),
        },
        "activity_definition": ACTIVITY_DEFINITION,
        "students": students,
    }


def safe_cell(value):
    # Spreadsheet formula injection: names/emails are user-controlled.
    text = "" if value is None else str(value)
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


def report_csv(report):
    lab_ids = [lab["id"] for lab in report["students"][0]["labs"]] if report["students"] else []
    header = [
        "Email",
        "Họ tên",
        "Trạng thái thành viên",
        "Tiến độ (%)",
        "Số lab đạt",
        "Tổng số lab",
        "Tổng lượt Lab Test",
        "Bài chờ duyệt",
        "Hoạt động gần nhất (UTC)",
        "Lab có lịch sử biên dịch cũ",
    ]
    for lab_id in lab_ids:
        header += [f"Lab {lab_id} đạt", f"Lab {lab_id} điểm cao nhất", f"Lab {lab_id} số lượt"]
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(header)
    for s in report["students"]:
        row = [
            s["email"],
            s["full_name"],
            "Đang học" if s["membership_status"] == MembershipStatus.active else "Đã xóa",
            s["percent"],
            s["completed_labs"],
            s["total_labs"],
            s["attempts_total"],
            s["pending_reviews"],
            s["last_activity_at"] or "",
            " ".join(str(lab) for lab in s["legacy_compiled_labs"]),
        ]
        for lab in s["labs"]:
            row += ["Có" if lab["completed"] else "Không", lab["best_score"], lab["attempts"]]
        writer.writerow([safe_cell(cell) for cell in row])
    # BOM lets spreadsheet software detect UTF-8 Vietnamese text.
    return "\ufeff" + output.getvalue()


async def active_students(db, days):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    events = (
        select(ClassMembership.user_id.label("user_id"))
        .join(ProgressEvent, ProgressEvent.membership_id == ClassMembership.id)
        .where(
            ClassMembership.role == MembershipRole.student,
            ProgressEvent.created_at >= cutoff,
            ProgressEvent.kind.not_in(TEACHER_EVENT_KINDS),
        )
    )
    attempts = (
        select(ClassMembership.user_id.label("user_id"))
        .join(QuizAttempt, QuizAttempt.membership_id == ClassMembership.id)
        .where(QuizAttempt.started_at >= cutoff)
    )
    activity = union_all(events, attempts).subquery()
    return (await db.execute(select(func.count(func.distinct(activity.c.user_id))))).scalar_one()


async def admin_dashboard(db, admin):
    users = {}
    for role, status, count in (
        await db.execute(
            select(User.role, User.status, func.count())
            .where(User.deleted_at.is_(None))
            .group_by(User.role, User.status)
        )
    ).all():
        users.setdefault(role.value, {s.value: 0 for s in AccountStatus})[status.value] = count
    classes = {"by_status": {s.value: 0 for s in ClassStatus}, "by_mode": {}}
    for status, mode, count in (
        await db.execute(
            select(Classroom.status, Classroom.lms_mode, func.count()).group_by(
                Classroom.status, Classroom.lms_mode
            )
        )
    ).all():
        classes["by_status"][status.value] += count
        classes["by_mode"][mode] = classes["by_mode"].get(mode, 0) + count
    labs = {}
    rows = (
        await db.execute(
            select(Classroom)
            .where(Classroom.status == ClassStatus.active, Classroom.lms_mode != "off")
            .order_by(Classroom.id)
        )
    ).scalars()
    for classroom in rows:
        access = ClassAccess(classroom, admin, None)
        try:
            config = await raw_config(db, access)
        except LMSError:
            continue  # Class without a published curriculum has nothing to complete yet.
        members = [
            member
            for member, _ in await class_members(db, access)
            if member.status == MembershipStatus.active
        ]
        for path in (await member_paths(db, config, members)).values():
            for lab in path["labs"]:
                entry = labs.setdefault(lab["id"], {"eligible": 0, "completed": 0})
                entry["eligible"] += 1
                entry["completed"] += lab["completed"]
    best = (
        select(
            QuizAttempt.membership_id,
            QuizAttempt.lab_id,
            func.max(QuizAttempt.score).label("best"),
        )
        .join(Classroom, Classroom.id == QuizAttempt.class_id)
        .where(
            QuizAttempt.status != "active",
            Classroom.status == ClassStatus.active,
            Classroom.lms_mode != "off",
        )
        .group_by(QuizAttempt.membership_id, QuizAttempt.lab_id)
        .subquery()
    )
    scores = {
        lab_id: (float(avg), count)
        for lab_id, avg, count in (
            await db.execute(
                select(best.c.lab_id, func.avg(best.c.best), func.count()).group_by(best.c.lab_id)
            )
        ).all()
    }
    lab_ids = sorted(labs.keys() | scores.keys())
    return {
        "generated_at": iso(datetime.now(timezone.utc)),
        "users": users,
        "classes": classes,
        "active_students": {
            "last_7_days": await active_students(db, 7),
            "last_30_days": await active_students(db, 30),
        },
        "labs": [
            {
                "id": lab_id,
                "eligible_students": labs.get(lab_id, {}).get("eligible", 0),
                "completed_students": labs.get(lab_id, {}).get("completed", 0),
                "completion_rate": round(labs[lab_id]["completed"] / labs[lab_id]["eligible"], 4)
                if labs.get(lab_id, {}).get("eligible")
                else None,
                "average_best_score": round(scores[lab_id][0], 2) if lab_id in scores else None,
                "scored_students": scores.get(lab_id, (None, 0))[1],
            }
            for lab_id in lab_ids
        ],
        "definitions": {
            "active_students": ACTIVITY_DEFINITION,
            "completion_rate": "SV đang học trong lớp đang mở có lab đạt / SV có lab đó được bật.",
            "average_best_score": "Trung bình điểm cao nhất (trên 5) của mỗi SV đã nộp Lab Test.",
        },
    }
