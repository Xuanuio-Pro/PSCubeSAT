"""Draft/publish class snapshots; only effective, enabled content reaches students."""

from copy import deepcopy
from datetime import datetime, timezone
from types import SimpleNamespace
from urllib.parse import urlsplit

from sqlalchemy import delete, func, select

from app.core.lms_errors import LMSError
from app.models.curriculum import ClassCourseVersion, ClassLessonSetting, CourseVersion, Lab, Lesson
from app.models.learning import (
    CompletionOverride,
    LessonProgress,
    PracticeSubmission,
    Prerequisite,
)
from app.models.quiz import QuestionBank, QuestionVersion, QuizPolicy
from app.models.tables import ClassMembership, Classroom, MembershipRole, MembershipStatus
from app.services.classes import audit
from app.services.learning_rules import BRANCHING
from app.services.sample_questions import default_policy

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
    "labtest": {
        "time_limit_minutes",
        "max_attempts",
        "cooldown_minutes",
        "pass_score",
        "estimated_minutes",
    },
    "quiz": {
        "time_limit_minutes",
        "max_attempts",
        "cooldown_minutes",
        "pass_score",
        "estimated_minutes",
    },
}


def safe_content(content, lesson_type, *, manager=False):
    allowed = ALLOWED_PARAMS[lesson_type] | {
        "group",
        "exercise_id",
        "exercises",
        "repository_url",
        "mode",
        "bank_ready",
        "evidence",
        "description",
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
    required = lesson.type in {"labtest", "quiz"} or (
        lesson.type == "document" and bool(lesson.content.get("markdown"))
    )
    return {
        "enabled": True,
        "required": required,
        "order_no": lesson.order_no,
        "params": {},
    }


async def latest_published_course_version(db):
    return (
        await db.execute(
            select(CourseVersion)
            .where(CourseVersion.status == "published")
            .order_by(CourseVersion.version.desc(), CourseVersion.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def configuration(
    db, access, *, draft=False, student_view=False, version_id=None, apply_access=True
):
    if draft and not access.can_manage:
        raise LMSError(403, "FORBIDDEN_ROLE", "Chỉ giảng viên của lớp được xem cấu hình nháp.")
    row = await latest(db, access.classroom.id, "draft" if draft else "published")
    if row is None and (draft or access.can_manage):
        row = await latest(db, access.classroom.id)
    latest_cv = await latest_published_course_version(db)
    if row is None:
        if not access.can_manage:
            raise LMSError(409, "CONFIG_INVALID", "Lớp chưa có chương trình được xuất bản.")
        if not version_id:
            version_id = latest_cv.id if latest_cv else ""
    else:
        version_id = row.course_version_id
    labs, lessons = await course_data(db, version_id)
    quiz_policies = {
        p.lesson_id: p
        for p in (
            await db.execute(select(QuizPolicy).where(QuizPolicy.class_id == access.classroom.id))
        ).scalars()
    }
    quiz_banks = {
        lesson_id: course_id
        for lesson_id, course_id in (
            await db.execute(
                select(QuizPolicy.lesson_id, QuestionBank.course_version_id)
                .join(QuestionBank, QuestionBank.id == QuizPolicy.bank_id)
                .where(
                    QuizPolicy.class_id == access.classroom.id, QuestionBank.status == "published"
                )
            )
        ).all()
    }
    latest_banks: dict[str, QuestionBank] = {}
    bank_counts: dict[str, dict[str, int]] = {}
    if access.can_manage and not student_view:
        for bank in (
            await db.execute(
                select(QuestionBank)
                .where(
                    QuestionBank.class_id == access.classroom.id,
                    QuestionBank.course_version_id == version_id,
                )
                .order_by(QuestionBank.version.desc())
            )
        ).scalars():
            latest_banks.setdefault(bank.lesson_id, bank)
        if latest_banks:
            for bank_id, q_status, cnt in (
                await db.execute(
                    select(
                        QuestionVersion.bank_id,
                        QuestionVersion.status,
                        func.count(QuestionVersion.id),
                    )
                    .where(QuestionVersion.bank_id.in_([b.id for b in latest_banks.values()]))
                    .group_by(QuestionVersion.bank_id, QuestionVersion.status)
                )
            ).all():
                bank_counts.setdefault(bank_id, {})[q_status] = cnt
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
    if access.can_manage and not student_view:
        result["latest_course_version_id"] = latest_cv.id if latest_cv else version_id
        result["course_upgrade_available"] = bool(
            row and latest_cv and row.course_version_id != latest_cv.id
        )
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
            if lesson.type in ("labtest", "quiz"):
                policy_row = quiz_policies.get(lesson.id)
                policy_values = (
                    {
                        key: getattr(policy_row, key)
                        for key in (
                            "time_limit_minutes",
                            "pass_score",
                            "max_attempts",
                            "cooldown_minutes",
                            "num_questions",
                        )
                    }
                    if policy_row
                    else default_policy(lesson.type)
                )
                content.update(policy_values)
            content.update(
                {k: v for k, v in values["params"].items() if k in ALLOWED_PARAMS[lesson.type]}
            )
            if lesson.type in ("labtest", "quiz"):
                content["bank_ready"] = quiz_banks.get(lesson.id) == version_id
                if access.can_manage and not student_view:
                    bank = latest_banks.get(lesson.id)
                    counts = bank_counts.get(bank.id, {}) if bank else {}
                    approved_count = counts.get("approved", 0)
                    draft_count = counts.get("draft", 0)
                    content["bank_status"] = bank.status if bank else "uninitialized"
                    content["bank_approved_count"] = approved_count
                    content["bank_draft_count"] = draft_count
                    content["bank_auto_publishable"] = (
                        bank is not None
                        and bank.status == "draft"
                        and approved_count >= 1
                        and draft_count == 0
                    )
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
        elif key == "max_attempts":
            valid = value is None or (type(value) is int and 0 < value <= 100)
        elif key == "cooldown_minutes":
            valid = type(value) is int and 0 <= value <= 1440
        elif key in {"estimated_minutes", "time_limit_minutes", "pass_score"}:
            valid = type(value) is int and 0 < value <= {
                "pass_score": 200,
                "time_limit_minutes": 180,
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
    if (
        effective
        and effective.course_version_id != request.course_version_id
        and not (
            previous
            and previous.status == "draft"
            and previous.course_version_id == request.course_version_id
        )
    ):
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
            if lab["enabled"] and lesson["enabled"] and lesson["type"] in ("quiz", "labtest"):
                content = lesson["content"]
                draft_count = content.get("bank_draft_count", 0)
                publishable = bool(
                    content.get("bank_ready") or content.get("bank_auto_publishable")
                )
                if draft_count > 0:
                    errors.append(
                        {
                            "lab_id": lab["id"],
                            "lesson_id": lesson["id"],
                            "code": "QUIZ_DRAFT_UNAPPROVED",
                            "message": (
                                f"Bài có {draft_count} câu hỏi nháp chưa duyệt. "
                                "Hãy duyệt hoặc xóa câu nháp trước khi xuất bản."
                            ),
                        }
                    )
                elif lesson["type"] == "quiz" and not publishable:
                    # A quiz completes only by passing, so an enabled quiz without questions would
                    # lock every later lesson of the lab.
                    errors.append(
                        {
                            "lab_id": lab["id"],
                            "lesson_id": lesson["id"],
                            "code": "QUIZ_BANK_NOT_READY",
                            "message": "Bài câu hỏi đang bật nhưng chưa có ngân hàng câu hỏi đã duyệt và xuất bản.",
                        }
                    )
                elif lesson["type"] == "labtest" and not publishable:
                    errors.append(
                        {
                            "lab_id": lab["id"],
                            "lesson_id": lesson["id"],
                            "code": "CONTENT_MISSING",
                            "message": "Bài bắt buộc thiếu nội dung, URL hoặc ngân hàng đã duyệt.",
                        }
                    )
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
    if not dry_run:
        await db.execute(
            select(Classroom.id).where(Classroom.id == access.classroom.id).with_for_update()
        )
    row = await latest(db, access.classroom.id, "draft")
    if row is None or row.version != expected_version:
        raise LMSError(
            409, "VERSION_CONFLICT", "Không có bản nháp đúng phiên bản. Hãy tải lại cấu hình."
        )
    config = await configuration(db, access, draft=True)
    errors = validate_configuration(config)
    if errors:
        invalid(errors)
    auto_publish_lesson_ids = [
        lesson["id"]
        for lab in config["labs"]
        if lab["enabled"]
        for lesson in lab["lessons"]
        if lesson["enabled"] and lesson["content"].get("bank_auto_publishable")
    ]
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
    response = {
        "dry_run": dry_run,
        "affected_students": count,
        "version": row.version,
        "auto_publish_banks": auto_publish_lesson_ids,
    }
    if not dry_run:
        if auto_publish_lesson_ids:
            from app.services.question_banks import latest_bank, publish_bank_row

            for lesson_id in auto_publish_lesson_ids:
                bank = await latest_bank(db, access, lesson_id)
                if (
                    bank is None
                    or bank.status != "draft"
                    or bank.course_version_id != row.course_version_id
                ):
                    raise LMSError(
                        409,
                        "VERSION_CONFLICT",
                        "Ngân hàng câu hỏi đã thay đổi. Hãy tải lại cấu hình.",
                    )
                policy = await db.get(QuizPolicy, (row.class_id, lesson_id))
                if policy is None:
                    raise LMSError(409, "BANK_NOT_READY", "Thiếu chính sách ngân hàng câu hỏi.")
                await publish_bank_row(db, access.user.id, bank, policy)
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


_PROGRESS_RANK = {
    "completed": 4,
    "waived": 4,
    "pending_review": 3,
    "in_progress": 2,
    "not_started": 1,
}

# Practice IDs aligned to README names; old -> new mapping preserves settings and progress on upgrade.
PRACTICE_ID_RENAMES: dict[str, str] = {
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
PRACTICE_ID_ALIASES: dict[str, str] = {new: old for old, new in PRACTICE_ID_RENAMES.items()}

GROUPED_PRACTICE_CANONICAL: dict[str, tuple[str, ...]] = {
    "practice-1-led": ("Lab1-01_Blink_LED", "Lab1-02_Control_Multiple_LEDs", "Lab1-03_PWM_LED"),
    "practice-1-button": ("Lab1-04_Button", "Lab1-05_LED_Button"),
    "practice-1-uart": ("Lab1-07_Serial_Communication", "Lab1-08_Serial_Control_LED"),
    "practice-1-wifi": (
        "Lab1-09_WiFi_Connection",
        "Lab1-10_WiFi_AP_Mode",
        "Lab1-11_Web_Server_LED",
    ),
    "practice-2-max17048": ("Lab2-01a_Battery_I2C", "Lab2-01b_Battery_Library"),
    "practice-3-sd": ("Lab3-01a_MicroSD_SPI", "Lab3-01b_MicroSD_Library"),
    "practice-4-bmp280": ("Lab4-01a_Environment_I2C", "Lab4-01b_Environment_Library"),
    "practice-4-imu": ("Lab4-02a_IMU_I2C", "Lab4-02b_IMU_Library"),
    "practice-4-nmea-raw": ("Lab4-03a_GPS_UART", "Lab4-03b_GPS_Library"),
    "practice-4-camera": ("Lab4-04a_Camera_UART", "Lab4-04b_Camera_Library"),
    "practice-5-lora": (
        "Lab5-01a_Send_Telemetry_UART",
        "Lab5-01b_Send_Telemetry_Library",
        "Lab5-02a_Receive_Command_UART",
        "Lab5-02b_Receive_Command_Library",
    ),
}
GROUPED_PRACTICE_CHILDREN: dict[str, set[str]] = {
    parent: set(children) | {PRACTICE_ID_ALIASES[c] for c in children if c in PRACTICE_ID_ALIASES}
    for parent, children in GROUPED_PRACTICE_CANONICAL.items()
}
CHILD_TO_GROUPED_PARENT: dict[str, str] = {
    cid: parent for parent, children in GROUPED_PRACTICE_CHILDREN.items() for cid in children
}


def _merge_group_params(lesson, child_settings) -> dict:
    clean = {}
    allowed = ALLOWED_PARAMS[lesson.type]
    for key in ("instructions", "rubric", "evidence"):
        if key not in allowed:
            continue
        seen = []
        for s in child_settings:
            val = (s.params or {}).get(key)
            if isinstance(val, str) and val.strip() and val.strip() not in seen:
                seen.append(val.strip())
        if seen:
            clean[key] = "\n\n".join(seen)[:100000]
    for key in ("board", "estimated_minutes"):
        if key not in allowed:
            continue
        for s in child_settings:
            val = (s.params or {}).get(key)
            if val not in (None, ""):
                clean[key] = deepcopy(val)
                break
    return clean


def _utc_or_min(value):
    if value is None:
        return datetime.min.replace(tzinfo=timezone.utc)
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _keep_required_on_upgrade(lesson, clean_params, old_setting, enable_all_lessons: bool) -> bool:
    if not old_setting.required:
        return False
    if lesson.type == "video":
        effective_url = clean_params.get("url") or lesson.content.get("url", "")
        effective_tracking = clean_params.get("tracking_mode") or lesson.content.get(
            "tracking_mode", "native"
        )
        effective_confirm = (
            clean_params["confirmation_allowed"]
            if "confirmation_allowed" in clean_params
            else lesson.content.get("confirmation_allowed")
        )
        effective_dur = (
            clean_params["duration_seconds"]
            if "duration_seconds" in clean_params
            else lesson.content.get("duration_seconds", 0)
        )
        return valid_url(effective_url) and (
            bool(effective_confirm)
            if effective_tracking == "confirmation"
            else (effective_dur or 0) > 0
        )
    if enable_all_lessons and not old_setting.enabled:
        if lesson.type == "document":
            return bool(
                (clean_params.get("markdown") or lesson.content.get("markdown", "")).strip()
            )
        if lesson.type == "practice":
            return bool(
                clean_params.get("instructions", "").strip()
                and clean_params.get("rubric", "").strip()
            )
    return True


async def _copy_progress_and_overrides(
    db,
    *,
    classroom_id: int,
    target_cv_id: str,
    target_lessons,
    prev_version: int,
    new_version: int,
    copy_progress: bool,
):
    if copy_progress:
        member_ids = list(
            (
                await db.execute(
                    select(ClassMembership.id).where(ClassMembership.class_id == classroom_id)
                )
            ).scalars()
        )
        if member_ids:
            target_ids = {item.id for item in target_lessons}
            grouped_targets = target_ids & set(GROUPED_PRACTICE_CANONICAL)
            lookup_ids = (
                target_ids
                | set(PRACTICE_ID_RENAMES)
                | {cid for cids in GROUPED_PRACTICE_CHILDREN.values() for cid in cids}
            )
            existing_keys = set(
                (
                    await db.execute(
                        select(LessonProgress.membership_id, LessonProgress.lesson_id).where(
                            LessonProgress.membership_id.in_(member_ids),
                            LessonProgress.course_version_id == target_cv_id,
                        )
                    )
                ).all()
            )
            old_rows = list(
                (
                    await db.execute(
                        select(LessonProgress).where(
                            LessonProgress.membership_id.in_(member_ids),
                            LessonProgress.course_version_id != target_cv_id,
                            LessonProgress.lesson_id.in_(lookup_ids),
                        )
                    )
                ).scalars()
            )
            best_by_key: dict[tuple[int, str], LessonProgress] = {}
            grouped_child_rows: dict[tuple[int, str], dict[str, LessonProgress]] = {}
            for row in old_rows:
                mapped_id = PRACTICE_ID_RENAMES.get(row.lesson_id, row.lesson_id)
                row_score = (_PROGRESS_RANK.get(row.status, 0), _utc_or_min(row.updated_at))
                if mapped_id in target_ids:
                    key = (row.membership_id, mapped_id)
                    if key in existing_keys:
                        continue
                    cur = best_by_key.get(key)
                    if cur is None or row_score > (
                        _PROGRESS_RANK.get(cur.status, 0),
                        _utc_or_min(cur.updated_at),
                    ):
                        best_by_key[key] = row
                elif mapped_id in CHILD_TO_GROUPED_PARENT:
                    parent_id = CHILD_TO_GROUPED_PARENT[mapped_id]
                    if parent_id not in grouped_targets:
                        continue
                    gkey = (row.membership_id, parent_id)
                    if gkey in existing_keys or gkey in best_by_key:
                        continue
                    child_map = grouped_child_rows.setdefault(gkey, {})
                    cur_child = child_map.get(mapped_id)
                    if cur_child is None or row_score > (
                        _PROGRESS_RANK.get(cur_child.status, 0),
                        _utc_or_min(cur_child.updated_at),
                    ):
                        child_map[mapped_id] = row

            all_old_ids = [row.id for row in best_by_key.values()] + [
                row.id for cmap in grouped_child_rows.values() for row in cmap.values()
            ]
            subs_by_prog: dict[int, list[PracticeSubmission]] = {}
            if all_old_ids:
                for sub in (
                    await db.execute(
                        select(PracticeSubmission)
                        .where(PracticeSubmission.progress_id.in_(all_old_ids))
                        .order_by(PracticeSubmission.revision)
                    )
                ).scalars():
                    subs_by_prog.setdefault(sub.progress_id, []).append(sub)

            for (_, mapped_id), row in best_by_key.items():
                copied = LessonProgress(
                    membership_id=row.membership_id,
                    lesson_id=mapped_id,
                    lesson_version=f"{target_cv_id}/{mapped_id}",
                    course_version_id=target_cv_id,
                    status=row.status,
                    last_position=row.last_position,
                    watched_segments=deepcopy(row.watched_segments),
                    started_at=row.started_at,
                    completed_at=row.completed_at,
                )
                db.add(copied)
                await db.flush()
                for sub in subs_by_prog.get(row.id, []):
                    db.add(
                        PracticeSubmission(
                            progress_id=copied.id,
                            revision=sub.revision,
                            code=sub.code,
                            rubric_snapshot=sub.rubric_snapshot,
                            status=sub.status,
                            feedback=sub.feedback,
                            reviewed_by=sub.reviewed_by,
                            reviewed_at=sub.reviewed_at,
                            created_at=sub.created_at,
                        )
                    )

            for (member_id, parent_id), child_map in grouped_child_rows.items():
                if (member_id, parent_id) in best_by_key:
                    continue
                canonical_children = GROUPED_PRACTICE_CANONICAL[parent_id]
                all_done = all(
                    cid in child_map and child_map[cid].status in ("completed", "waived")
                    for cid in canonical_children
                )
                any_started = any(r.status != "not_started" for r in child_map.values())
                merged_status = (
                    "completed" if all_done else ("in_progress" if any_started else "not_started")
                )
                started_dates = [
                    r.started_at for r in child_map.values() if r.started_at is not None
                ]
                completed_dates = [
                    r.completed_at for r in child_map.values() if r.completed_at is not None
                ]
                copied = LessonProgress(
                    membership_id=member_id,
                    lesson_id=parent_id,
                    lesson_version=f"{target_cv_id}/{parent_id}",
                    course_version_id=target_cv_id,
                    status=merged_status,
                    last_position=0,
                    watched_segments=[],
                    started_at=min(started_dates) if started_dates else None,
                    completed_at=(max(completed_dates) if all_done and completed_dates else None),
                )
                db.add(copied)
                await db.flush()
                rev = 1
                for cid in canonical_children:
                    child_row = child_map.get(cid)
                    if child_row is None:
                        continue
                    for sub in subs_by_prog.get(child_row.id, []):
                        prefix = f"// === {cid} ==="
                        code = (
                            sub.code
                            if sub.code.lstrip().startswith(prefix)
                            else f"{prefix}\n{sub.code}"
                        )
                        db.add(
                            PracticeSubmission(
                                progress_id=copied.id,
                                revision=rev,
                                code=code,
                                rubric_snapshot=sub.rubric_snapshot,
                                status=sub.status,
                                feedback=sub.feedback,
                                reviewed_by=sub.reviewed_by,
                                reviewed_at=sub.reviewed_at,
                                created_at=sub.created_at,
                            )
                        )
                        rev += 1
    for ov in (
        await db.execute(
            select(CompletionOverride).where(
                CompletionOverride.class_id == classroom_id,
                CompletionOverride.version == prev_version,
                CompletionOverride.action == "unlock",
            )
        )
    ).scalars():
        db.add(
            CompletionOverride(
                membership_id=ov.membership_id,
                class_id=ov.class_id,
                version=new_version,
                action=ov.action,
                lesson_version=ov.lesson_version,
                lab_id=ov.lab_id,
                actor=ov.actor,
                reason=ov.reason,
                created_at=ov.created_at,
            )
        )


async def upgrade_class_to_course_version(
    db,
    *,
    classroom_id: int,
    actor_id: int,
    target_course_version_id: str | None = None,
    enable_all_lessons: bool = False,
    commit: bool = True,
):
    """Upgrade a class onto `target_course_version_id` without mutating historical snapshots."""
    await db.execute(select(Classroom.id).where(Classroom.id == classroom_id).with_for_update())
    classroom = await db.get(Classroom, classroom_id)
    if classroom is None:
        invalid([{"code": "CLASS_NOT_FOUND", "message": "Không tìm thấy lớp học."}])

    target_cv = (
        await db.get(CourseVersion, target_course_version_id)
        if target_course_version_id
        else await latest_published_course_version(db)
    )
    if target_cv is None or target_cv.status != "published":
        invalid([{"code": "COURSE_NOT_PUBLISHED", "message": "Không có giáo trình đã xuất bản."}])

    labs, lessons = await course_data(db, target_cv.id)
    latest_row = await latest(db, classroom_id)
    pub_row = await latest(db, classroom_id, "published")
    if latest_row is None:
        return {
            "upgraded": False,
            "class_id": classroom_id,
            "upgraded_from": None,
            "upgraded_to": target_cv.id,
            "version": 0,
            "status": "draft",
        }

    old_settings = {
        s.lesson_id: s
        for s in (
            await db.execute(
                select(ClassLessonSetting).where(
                    ClassLessonSetting.class_id == classroom_id,
                    ClassLessonSetting.version == latest_row.version,
                )
            )
        ).scalars()
    }
    needs_cv_upgrade = latest_row.course_version_id != target_cv.id
    target_lesson_ids = {item.id for item in lessons}
    needs_enable_sync = enable_all_lessons and (
        any(not bool(item.get("enabled", True)) for item in (latest_row.lab_settings or []))
        or any(not s.enabled for s in old_settings.values())
        or set(old_settings) != target_lesson_ids
    )
    if not needs_cv_upgrade and not needs_enable_sync:
        return {
            "upgraded": False,
            "class_id": classroom_id,
            "upgraded_from": latest_row.course_version_id,
            "upgraded_to": target_cv.id,
            "version": latest_row.version,
            "status": latest_row.status,
        }

    from app.services.question_banks import (
        latest_bank,
        publish_bank_row,
        upgrade_banks_for_course_version,
    )

    await upgrade_banks_for_course_version(db, classroom_id, actor_id, target_cv.id, labs, lessons)

    old_edges: dict[int, list[int]] = {}
    for edge in (
        await db.execute(
            select(Prerequisite).where(
                Prerequisite.class_id == classroom_id, Prerequisite.version == latest_row.version
            )
        )
    ).scalars():
        old_edges.setdefault(edge.lab_id, []).append(edge.required_lab_id)
    old_lab_map = {
        item["lab_id"]: item for item in (latest_row.lab_settings or []) if "lab_id" in item
    }

    new_version = latest_row.version + 1
    new_lab_settings = []
    prereq_pairs = []
    for lab in labs:
        prev_lab = old_lab_map.get(lab.id)
        prereqs = sorted(
            set(old_edges.get(lab.id, prev_lab["prerequisites"] if prev_lab else BRANCHING[lab.id]))
        )
        enabled = (
            True
            if enable_all_lessons
            else (bool(prev_lab.get("enabled", True)) if prev_lab else True)
        )
        new_lab_settings.append({"lab_id": lab.id, "enabled": enabled, "prerequisites": prereqs})
        for req_id in prereqs:
            prereq_pairs.append((lab.id, req_id))

    new_row = ClassCourseVersion(
        class_id=classroom_id,
        version=new_version,
        course_version_id=target_cv.id,
        status="draft",
        lab_settings=new_lab_settings,
    )
    db.add(new_row)
    await db.flush()

    db.add_all(
        [
            Prerequisite(
                class_id=classroom_id,
                version=new_version,
                lab_id=lab_id,
                required_lab_id=req_id,
            )
            for lab_id, req_id in prereq_pairs
        ]
    )

    new_settings = []
    for lesson in lessons:
        old_s = old_settings.get(lesson.id) or old_settings.get(
            PRACTICE_ID_ALIASES.get(lesson.id, "")
        )
        if old_s is not None:
            clean_params = {
                k: deepcopy(v)
                for k, v in (old_s.params or {}).items()
                if k in ALLOWED_PARAMS[lesson.type]
            }
            enabled = True if enable_all_lessons else bool(old_s.enabled)
            required = _keep_required_on_upgrade(lesson, clean_params, old_s, enable_all_lessons)
            order_no = lesson.order_no if needs_cv_upgrade else old_s.order_no
        elif lesson.id in GROUPED_PRACTICE_CANONICAL:
            child_settings = [
                old_settings.get(cid) or old_settings.get(PRACTICE_ID_ALIASES.get(cid, ""))
                for cid in GROUPED_PRACTICE_CANONICAL[lesson.id]
            ]
            child_settings = [s for s in child_settings if s is not None]
            if child_settings:
                clean_params = _merge_group_params(lesson, child_settings)
                enabled = (
                    True if enable_all_lessons else any(bool(s.enabled) for s in child_settings)
                )
                required = any(
                    _keep_required_on_upgrade(lesson, clean_params, s, enable_all_lessons)
                    for s in child_settings
                )
                order_no = lesson.order_no
            else:
                base = defaults(lesson)
                clean_params = base["params"]
                enabled = base["enabled"]
                required = base["required"]
                order_no = base["order_no"]
        else:
            base = defaults(lesson)
            clean_params = base["params"]
            enabled = base["enabled"]
            required = base["required"]
            order_no = base["order_no"]
        setting = ClassLessonSetting(
            class_id=classroom_id,
            version=new_version,
            lesson_id=lesson.id,
            course_version_id=target_cv.id,
            enabled=enabled,
            required=required,
            order_no=order_no,
            params=clean_params,
            status="draft",
        )
        new_settings.append(setting)
        db.add(setting)
    await db.flush()

    await _copy_progress_and_overrides(
        db,
        classroom_id=classroom_id,
        target_cv_id=target_cv.id,
        target_lessons=lessons,
        prev_version=latest_row.version,
        new_version=new_version,
        copy_progress=needs_cv_upgrade,
    )
    await db.flush()

    if pub_row is not None:
        manage_access = SimpleNamespace(classroom=classroom, user=None, can_manage=True)
        draft_cfg = await configuration(db, manage_access, draft=True)
        auto_ids = [
            lesson["id"]
            for lab in draft_cfg["labs"]
            if lab["enabled"]
            for lesson in lab["lessons"]
            if lesson["enabled"] and lesson["content"].get("bank_auto_publishable")
        ]
        if auto_ids:
            for lid in auto_ids:
                bank = await latest_bank(db, manage_access, lid)
                if bank and bank.status == "draft" and bank.course_version_id == target_cv.id:
                    policy = await db.get(QuizPolicy, (classroom_id, lid))
                    if policy is not None:
                        await publish_bank_row(db, actor_id, bank, policy)
            draft_cfg = await configuration(db, manage_access, draft=True)
        if not validate_configuration(draft_cfg):
            for setting in new_settings:
                setting.status = "published"
            await db.flush()
            new_row.status = "published"
            await db.flush()

    report = {
        "upgraded": True,
        "class_id": classroom_id,
        "upgraded_from": latest_row.course_version_id,
        "upgraded_to": target_cv.id,
        "version": new_version,
        "status": new_row.status,
    }
    audit(
        db,
        actor_id,
        "curriculum.upgrade_course_version",
        f"class:{classroom_id}",
        {"course_version_id": latest_row.course_version_id, "version": latest_row.version},
        report,
    )
    if commit:
        await db.commit()
    return report


async def sync_classes_to_latest_course(db, *, enable_all_lessons: bool = True):
    """Upgrade all existing classes to the latest published course version cleanly."""
    target_cv = await latest_published_course_version(db)
    if target_cv is None:
        return []
    class_rows = list((await db.execute(select(Classroom).order_by(Classroom.id))).scalars())
    reports = []
    for classroom in class_rows:
        reports.append(
            await upgrade_class_to_course_version(
                db,
                classroom_id=classroom.id,
                actor_id=classroom.created_by,
                target_course_version_id=target_cv.id,
                enable_all_lessons=enable_all_lessons,
                commit=True,
            )
        )
    return reports


async def preview_curriculum(db):
    version = await latest_published_course_version(db)
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
