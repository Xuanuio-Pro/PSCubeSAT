"""Database-backed permissions, evaluated for each authenticated request."""

from dataclasses import dataclass

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.lms_errors import LMSError
from app.db import get_db
from app.models.tables import (
    ClassMembership,
    Classroom,
    ClassStatus,
    MembershipRole,
    MembershipStatus,
    User,
    UserRole,
)
from app.services.auth import get_required_user


def require_lms_enabled():
    if not get_settings().lms_class_mode:
        raise LMSError(404, "CONFIG_INVALID", "Chức năng lớp học chưa được bật.")


async def legacy_restricted(db: AsyncSession, user: User | None) -> bool:
    """Students of a pilot class (enabled or read-only) must not use the unlocked legacy path."""
    if not get_settings().lms_class_mode:
        return False
    if user is None:
        return False
    row = (
        await db.execute(
            select(ClassMembership.id)
            .join(Classroom, Classroom.id == ClassMembership.class_id)
            .where(
                ClassMembership.user_id == user.id,
                ClassMembership.role == MembershipRole.student,
                ClassMembership.status == MembershipStatus.active,
                Classroom.lms_mode.in_(("enabled", "read_only")),
                Classroom.status != ClassStatus.archived,
            )
            .limit(1)
        )
    ).scalar_one_or_none()
    return row is not None


async def require_legacy_allowed(
    user: User = Depends(get_required_user), db: AsyncSession = Depends(get_db)
):
    if await legacy_restricted(db, user):
        raise LMSError(403, "MEMBERSHIP_REQUIRED", "Hãy học và nộp bài từ lớp của bạn.")


def require_system_role(*roles: UserRole):
    async def dependency(user: User = Depends(get_required_user)):
        if user.role not in roles:
            raise LMSError(
                403, "FORBIDDEN_ROLE", "Tài khoản không có quyền thực hiện thao tác này."
            )
        return user

    return dependency


@dataclass
class ClassAccess:
    classroom: Classroom
    user: User
    membership: ClassMembership | None

    @property
    def can_manage(self):
        return self.user.role == UserRole.admin or (
            self.user.role == UserRole.teacher
            and self.membership is not None
            and self.membership.role == MembershipRole.teacher
        )


def require_class_member(*, roles=None, write=False):
    """Resolve class_id from the route; teachers also need a current system role."""

    async def dependency(
        class_id: int,
        user: User = Depends(get_required_user),
        db: AsyncSession = Depends(get_db),
        request: Request = None,
    ):
        query = select(Classroom).where(Classroom.id == class_id)
        if write:
            query = query.with_for_update()
        classroom = (await db.execute(query)).scalar_one_or_none()
        membership = (
            await db.execute(
                select(ClassMembership)
                .where(
                    ClassMembership.class_id == class_id,
                    ClassMembership.user_id == user.id,
                    ClassMembership.status == MembershipStatus.active,
                )
                .execution_options(populate_existing=True)
            )
        ).scalar_one_or_none()
        if user.role != UserRole.admin:
            if membership is None:
                raise LMSError(403, "MEMBERSHIP_REQUIRED", "Bạn không còn quyền truy cập lớp này.")
            if membership.role == MembershipRole.teacher and user.role != UserRole.teacher:
                raise LMSError(403, "FORBIDDEN_ROLE", "Quyền giảng viên đã được thu hồi.")
            if roles and membership.role not in roles:
                raise LMSError(
                    403, "FORBIDDEN_ROLE", "Chỉ giảng viên của lớp được thực hiện thao tác này."
                )
        if classroom is None:
            raise LMSError(404, "CONFIG_INVALID", "Không tìm thấy lớp học.")
        if user.role != UserRole.admin and membership.role == MembershipRole.student:
            if classroom.status == ClassStatus.draft:
                raise LMSError(403, "FORBIDDEN_ROLE", "Lớp học chưa được mở.")
            if classroom.lms_mode == "off":
                raise LMSError(403, "FORBIDDEN_ROLE", "Lớp chưa bật chế độ học theo lớp.")
        if write and classroom.status == ClassStatus.archived:
            raise LMSError(409, "CONFIG_INVALID", "Lớp đã lưu trữ, không thể thay đổi.")
        # Rollback switch: every write is refused, reads (results, reports) stay available.
        reading = request is not None and request.method in ("GET", "HEAD")
        if write and not reading and classroom.lms_mode == "read_only":
            raise LMSError(
                409, "CLASS_READ_ONLY", "Lớp đang tạm dừng ghi dữ liệu. Kết quả cũ vẫn được giữ."
            )
        return ClassAccess(classroom, user, membership)

    return dependency
