"""Draft/publish class snapshots; only effective, enabled content reaches students."""

from copy import deepcopy
from urllib.parse import urlsplit

from sqlalchemy import delete, func, select

from app.core.lms_errors import LMSError
from app.models.curriculum import ClassCourseVersion, ClassLessonSetting, CourseVersion, Lab, Lesson
from app.models.learning import Prerequisite
from app.models.quiz import QuestionBank, QuizPolicy
from app.models.tables import ClassMembership, MembershipRole, MembershipStatus
from app.services.classes import audit
from app.services.learning_rules import BRANCHING

ALLOWED_PARAMS = {
    "video": {
        "url",
        "estimated_minutes",
        "watch_ratio",
        "duration_seconds",
        "confirmation_allowed",
        "tracking_mode",
    },
    "document": {"markdown", "estimated_minutes"},
    "practice": {"instructions", "rubric", "board", "evidence", "estimated_minutes"},
    "labtest": {"time_limit_minutes", "max_attempts", "pass_score", "estimated_minutes"},
}


def safe_content(content, lesson_type, *, manager=False):
    allowed = ALLOWED_PARAMS[lesson_type] | {
        "group",
        "exercise_id",
        "repository_url",
        "mode",
        "bank_ready",
        "evidence",
    }
    if manager:
        allowed |= {"todos"}
    return {key: deepcopy(value) for key, value in content.items() if key in allowed}


def invalid(errors):
    raise LMSError(
        422,
        "CONFIG_INVALID",
        "Cấu hình chưa hợp lệ. Vui lòng kiểm tra các bài được đánh dấu.",
        {"errors": errors},
    )


async def latest(db, class_id, status=None):
    query = select(ClassCourseVersion).where(ClassCourseVersion.class_id == class_id)
    if status:
        query = query.where(ClassCourseVersion.status == status)
    return (
        await db.execute(query.order_by(ClassCourseVersion.version.desc()).limit(1))
    ).scalar_one_or_none()


async def course_data(db, version_id):
    version = await db.get(CourseVersion, version_id)
    if not version or version.status != "published":
        invalid([{"code": "COURSE_NOT_PUBLISHED", "message": "Chọn giáo trình đã xuất bản."}])
    labs = list(
        (
            await db.execute(
                select(Lab).where(Lab.course_version_id == version_id).order_by(Lab.order_no)
            )
        ).scalars()
    )
    lessons = list(
        (
            await db.execute(
                select(Lesson)
                .where(Lesson.course_version_id == version_id)
                .order_by(Lesson.order_no)
            )
        ).scalars()
    )
    return labs, lessons


def defaults(lesson):
    enabled = lesson.type != "labtest" and (
        lesson.type != "video" or bool(lesson.content.get("url"))
    )
    return {
        "enabled": enabled,
        "required": lesson.type == "document" and bool(lesson.content.get("markdown")),
        "order_no": lesson.order_no,
        "params": {},
    }


async def configuration(
    db, access, *, draft=False, student_view=False, version_id=None, apply_access=True
):
    if draft and not access.can_manage:
        raise LMSError(403, "FORBIDDEN_ROLE", "Chỉ giảng viên của lớp được xem cấu hình nháp.")
    row = await latest(db, access.classroom.id, "draft" if draft else "published")
    if row is None and draft:
        row = await latest(db, access.classroom.id, "published")
    if row is None:
        if not access.can_manage or student_view:
            raise LMSError(409, "CONFIG_INVALID", "Lớp chưa có chương trình được xuất bản.")
        if not version_id:
            course = (
                await db.execute(
                    select(CourseVersion)
                    .where(CourseVersion.status == "published")
                    .order_by(CourseVersion.created_at.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            version_id = course.id if course else ""
    else:
        version_id = row.course_version_id
    labs, lessons = await course_data(db, version_id)
    quiz_policies = {
        p.lab_id: p
        for p in (
            await db.execute(select(QuizPolicy).where(QuizPolicy.class_id == access.classroom.id))
        ).scalars()
    }
    quiz_banks = {
        lab_id: course_id
        for lab_id, course_id in (
            await db.execute(
                select(QuizPolicy.lab_id, QuestionBank.course_version_id)
                .join(QuestionBank, QuestionBank.id == QuizPolicy.bank_id)
                .where(
                    QuizPolicy.class_id == access.classroom.id, QuestionBank.status == "published"
                )
            )
        ).all()
    }
    settings = {}
    if row:
        settings = {
            item.lesson_id: item
            for item in (
                await db.execute(
                    select(ClassLessonSetting).where(
                        ClassLessonSetting.class_id == row.class_id,
                        ClassLessonSetting.version == row.version,
                    )
                )
            ).scalars()
        }
    lab_settings = {item["lab_id"]: item for item in row.lab_settings} if row else {}
    edges = {}
    if row:
        for edge in (
            await db.execute(
                select(Prerequisite).where(
                    Prerequisite.class_id == row.class_id, Prerequisite.version == row.version
                )
            )
        ).scalars():
            edges.setdefault(edge.lab_id, []).append(edge.required_lab_id)
    result = {
        "class_id": access.classroom.id,
        "course_version_id": version_id,
        "version": row.version if row else 0,
        "status": row.status if row else "draft",
        "can_manage": access.can_manage and not student_view,
        "labs": [],
    }
    for lab in labs:
        lab_setting = lab_settings.get(
            lab.id, {"enabled": True, "prerequisites": BRANCHING[lab.id]}
        )
        if (not access.can_manage or student_view) and not lab_setting["enabled"]:
            continue
        output = {
            "id": lab.id,
            "title": lab.title,
            "objectives": lab.objectives,
            "estimated_minutes": lab.estimated_minutes,
            "groups": lab.groups,
            "evidence": lab.evidence,
            "enabled": lab_setting["enabled"],
            "prerequisites": sorted(edges.get(lab.id, [])) if row else lab_setting["prerequisites"],
            "lessons": [],
        }
        for lesson in (item for item in lessons if item.lab_id == lab.id):
            setting = settings.get(lesson.id)
            values = (
                {k: getattr(setting, k) for k in ("enabled", "required", "order_no", "params")}
                if setting
                else defaults(lesson)
            )
            if (not access.can_manage or student_view) and not values["enabled"]:
                continue
            content = safe_content(
                lesson.content, lesson.type, manager=access.can_manage and not student_view
            )
            if lesson.type == "labtest" and lab.id in quiz_policies:
                content.update(
                    {
                        key: getattr(quiz_policies[lab.id], key)
                        for key in ("time_limit_minutes", "pass_score", "max_attempts")
                    }
                )
            content.update(
                {k: v for k, v in values["params"].items() if k in ALLOWED_PARAMS[lesson.type]}
            )
            if lesson.type == "labtest":
                content["bank_ready"] = quiz_banks.get(lab.id) == version_id
            if not access.can_manage or student_view:
                content.pop("todos", None)
            output["lessons"].append(
                {
                    "id": lesson.id,
                    "type": lesson.type,
                    "title": lesson.title,
                    **values,
                    "content": content,
                    "completion_rule": lesson.completion_rule,
                    "preview_allowed": lesson.preview_allowed,
                }
            )
        output["lessons"].sort(key=lambda item: (item["order_no"], item["id"]))
        result["labs"].append(output)
    if apply_access and not access.can_manage:
        from app.services.learning_progress import restricted_config

        return await restricted_config(db, access, result)
    return result


def validate_params(lesson, params):
    errors = []
    unknown = set(params) - ALLOWED_PARAMS[lesson.type]
    if unknown:
        errors.append(
            {
                "lesson_id": lesson.id,
                "code": "UNKNOWN_PARAMS",
                "message": "Tham số không được hỗ trợ: " + ", ".join(sorted(unknown)),
            }
        )
    for key, value in params.items():
        valid = True
        if key in {"url", "markdown", "instructions", "rubric", "board", "evidence"}:
            valid = isinstance(value, str) and len(value) <= 100000
        elif key == "watch_ratio":
            valid = type(value) in (int, float) and 0 < value <= 1
        elif key == "duration_seconds":
            valid = type(value) in (int, float) and 0 < value <= 86400
        elif key == "confirmation_allowed":
            valid = type(value) is bool
        elif key == "tracking_mode":
            valid = value in ("native", "confirmation")
        elif key in {"estimated_minutes", "time_limit_minutes", "max_attempts", "pass_score"}:
            valid = type(value) is int and 0 < value <= {
                "pass_score": 5,
                "time_limit_minutes": 180,
                "max_attempts": 100,
            }.get(key, 10000)
        if key == "board" and value not in ("esp32", "esp32s3"):
            valid = False
        if key == "url" and value and not valid_url(value):
            valid = False
        if not valid:
            errors.append(
                {
                    "lesson_id": lesson.id,
                    "code": "INVALID_PARAM",
                    "field": key,
                    "message": f"Tham số {key} không hợp lệ.",
                }
            )
    return errors


def valid_url(value):
    try:
        url = urlsplit(value)
        return (
            url.scheme == "https" and bool(url.hostname) and not url.username and not url.password
        )
    except ValueError:
        return False


async def save_settings(db, access, request):
    previous = await latest(db, access.classroom.id)
    if (previous.version if previous else 0) != request.expected_version:
        raise LMSError(409, "VERSION_CONFLICT", "Cấu hình đã thay đổi. Hãy tải lại trước khi lưu.")
    effective = await latest(db, access.classroom.id, "published")
    if effective and effective.course_version_id != request.course_version_id:
        invalid(
            [
                {
                    "code": "COURSE_VERSION_CHANGE",
                    "message": "Không đổi phiên bản giáo trình của lớp đã xuất bản trong luồng này.",
                }
            ]
        )
    labs, lessons = await course_data(db, request.course_version_id)
    errors = []
    lab_ids = [item.lab_id for item in request.labs]
    lesson_ids = [item.lesson_id for item in request.lessons]
    if len(set(lab_ids)) != len(lab_ids) or set(lab_ids) != {item.id for item in labs}:
        errors.append(
            {"code": "LAB_SET_INVALID", "message": "Cần đúng và đủ danh sách lab của phiên bản."}
        )
    if len(set(lesson_ids)) != len(lesson_ids) or set(lesson_ids) != {item.id for item in lessons}:
        errors.append(
            {"code": "LESSON_SET_INVALID", "message": "Cần đúng và đủ danh sách bài của phiên bản."}
        )
    by_id = {item.id: item for item in lessons}
    for lab in request.labs:
        if lab.lab_id in lab.prerequisites:
            errors.append(
                {
                    "code": "PREREQUISITE_CYCLE",
                    "lab_id": lab.lab_id,
                    "message": "Lab không thể phụ thuộc chính nó.",
                }
            )
    for item in request.lessons:
        if item.lesson_id in by_id:
            errors.extend(validate_params(by_id[item.lesson_id], item.params))
    if errors:
        invalid(errors)
    if previous and previous.status == "draft":
        row = previous
        await db.execute(
            delete(Prerequisite).where(
                Prerequisite.class_id == row.class_id, Prerequisite.version == row.version
            )
        )
        await db.execute(
            delete(ClassLessonSetting).where(
                ClassLessonSetting.class_id == row.class_id,
                ClassLessonSetting.version == row.version,
            )
        )
        # A distinct revision on each save provides optimistic concurrency for draft edits too.
        await db.delete(row)
        await db.flush()
    revision = (previous.version if previous else 0) + 1
    from app.services.question_banks import seed_banks

    await seed_banks(db, access, request.course_version_id)
    row = ClassCourseVersion(
        class_id=access.classroom.id,
        version=revision,
        course_version_id=request.course_version_id,
        status="draft",
        lab_settings=[item.model_dump() for item in request.labs],
    )
    db.add(row)
    await db.flush()
    db.add_all(
        [
            Prerequisite(
                class_id=row.class_id, version=revision, lab_id=lab.lab_id, required_lab_id=required
            )
            for lab in request.labs
            for required in set(lab.prerequisites)
        ]
    )
    db.add_all(
        [
            ClassLessonSetting(
                class_id=row.class_id,
                version=revision,
                course_version_id=row.course_version_id,
                status="draft",
                **item.model_dump(),
            )
            for item in request.lessons
        ]
    )
    audit(
        db,
        access.user.id,
        "curriculum.draft",
        f"class:{row.class_id}",
        {"version": request.expected_version},
        {"version": revision, "course_version_id": row.course_version_id},
    )
    await db.commit()
    return await configuration(db, access, draft=True)


def validate_configuration(config):
    errors = []
    labs = {lab["id"]: lab for lab in config["labs"]}
    for lab in labs.values():
        if lab["enabled"] and not any(
            item["enabled"] and item["required"] for item in lab["lessons"]
        ):
            errors.append(
                {
                    "lab_id": lab["id"],
                    "code": "NO_REQUIRED_LESSON",
                    "message": "Lab không còn bài bắt buộc đang bật.",
                }
            )
        for dependency in lab["prerequisites"]:
            if lab["enabled"] and (dependency not in labs or not labs[dependency]["enabled"]):
                errors.append(
                    {
                        "lab_id": lab["id"],
                        "code": "DISABLED_PREREQUISITE",
                        "message": f"Lab {dependency} là tiên quyết nhưng đã tắt hoặc không tồn tại.",
                    }
                )
        orders = [item["order_no"] for item in lab["lessons"]]
        if len(orders) != len(set(orders)):
            errors.append(
                {
                    "lab_id": lab["id"],
                    "code": "DUPLICATE_ORDER",
                    "message": "Thứ tự bài trong lab phải khác nhau.",
                }
            )
        for lesson in lab["lessons"]:
            if not lab["enabled"] or not lesson["enabled"] or not lesson["required"]:
                continue
            content = lesson["content"]
            missing = (
                lesson["type"] == "video"
                and (
                    not valid_url(content.get("url", ""))
                    or (
                        not content.get("confirmation_allowed")
                        if content.get("tracking_mode", "native") == "confirmation"
                        else not content.get("duration_seconds", 0) > 0
                    )
                )
                or lesson["type"] == "document"
                and not content.get("markdown", "").strip()
                or lesson["type"] == "practice"
                and not (
                    content.get("instructions", "").strip() and content.get("rubric", "").strip()
                )
                or lesson["type"] == "labtest"
                and not content.get("bank_ready")
            )
            if missing:
                errors.append(
                    {
                        "lab_id": lab["id"],
                        "lesson_id": lesson["id"],
                        "code": "CONTENT_MISSING",
                        "message": "Bài bắt buộc thiếu nội dung, URL hoặc ngân hàng đã duyệt.",
                    }
                )
    visiting, visited = set(), set()

    def visit(node):
        if node in visiting:
            return True
        if node in visited or node not in labs:
            return False
        visiting.add(node)
        cycle = any(visit(item) for item in labs[node]["prerequisites"])
        visiting.remove(node)
        visited.add(node)
        return cycle

    if any(visit(node) for node in labs):
        errors.append({"code": "PREREQUISITE_CYCLE", "message": "Lộ trình có chu trình phụ thuộc."})
    if not any(lab["enabled"] for lab in labs.values()):
        errors.append(
            {"code": "NO_ENABLED_LAB", "message": "Chương trình cần ít nhất một lab được bật."}
        )
    return errors


async def publish(db, access, expected_version, dry_run):
    row = await latest(db, access.classroom.id, "draft")
    if row is None or row.version != expected_version:
        raise LMSError(
            409, "VERSION_CONFLICT", "Không có bản nháp đúng phiên bản. Hãy tải lại cấu hình."
        )
    config = await configuration(db, access, draft=True)
    errors = validate_configuration(config)
    if errors:
        invalid(errors)
    count = (
        await db.execute(
            select(func.count())
            .select_from(ClassMembership)
            .where(
                ClassMembership.class_id == row.class_id,
                ClassMembership.role == MembershipRole.student,
                ClassMembership.status == MembershipStatus.active,
            )
        )
    ).scalar_one()
    response = {"dry_run": dry_run, "affected_students": count, "version": row.version}
    if not dry_run:
        for item in (
            await db.execute(
                select(ClassLessonSetting).where(
                    ClassLessonSetting.class_id == row.class_id,
                    ClassLessonSetting.version == row.version,
                )
            )
        ).scalars():
            item.status = "published"
        await db.flush()
        row.status = "published"
        audit(db, access.user.id, "curriculum.publish", f"class:{row.class_id}", None, response)
        await db.commit()
    return response


async def preview_curriculum(db):
    version = (
        await db.execute(
            select(CourseVersion)
            .where(CourseVersion.status == "published")
            .order_by(CourseVersion.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if not version:
        raise LMSError(409, "CONFIG_INVALID", "Chưa có giáo trình trải nghiệm.")
    labs, lessons = await course_data(db, version.id)
    return {
        "course_version_id": version.id,
        "labs": [
            {
                "id": lab.id,
                "title": lab.title,
                "lessons": [
                    {
                        "id": item.id,
                        "type": item.type,
                        "title": item.title,
                        "content": safe_content(item.content, item.type),
                    }
                    for item in lessons
                    if item.lab_id == lab.id and item.preview_allowed
                ],
            }
            for lab in labs
            if any(item.lab_id == lab.id and item.preview_allowed for item in lessons)
        ],
    }
