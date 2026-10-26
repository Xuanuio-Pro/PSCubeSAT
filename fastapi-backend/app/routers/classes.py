from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
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
from app.schemas.classes import (
    ClassCreate,
    ClassPage,
    ClassPatch,
    ClassResponse,
    MemberAdd,
    MemberPage,
    MemberRemove,
    MemberResponse,
)
from app.services import classes as service
from app.services.auth import get_required_user
from app.services.curriculum_access import lab_entry as resolve_lab_entry
from app.services.permissions import (
    ClassAccess,
    legacy_restricted,
    require_class_member,
    require_lms_enabled,
    require_system_role,
)

config_router = APIRouter(prefix="/api/lms", tags=["classes"])
router = APIRouter(
    prefix="/api/classes",
    tags=["classes"],
    dependencies=[
        Depends(get_required_user),
        Depends(require_lms_enabled),
    ],
)
manage_class = require_class_member(roles=[MembershipRole.teacher], write=True)
read_members = require_class_member(roles=[MembershipRole.teacher])


@config_router.get("/config")
async def config(user: User = Depends(get_required_user), db: AsyncSession = Depends(get_db)):
    return {
        "class_mode": get_settings().lms_class_mode,
        "legacy_allowed": not await legacy_restricted(db, user),
    }


@config_router.get("/lab-entry")
async def lab_entry(
    lab_id: int = Query(ge=0, le=8),
    lesson: str | None = Query(default=None, max_length=200),
    user: User = Depends(get_required_user),
    db: AsyncSession = Depends(get_db),
):
    return await resolve_lab_entry(db, user, lab_id, lesson)


@router.get("", response_model=ClassPage)
async def list_classes(
    search: str = Query(default="", max_length=200),
    status: ClassStatus | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_required_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Classroom, ClassMembership.role).outerjoin(
        ClassMembership,
        and_(
            ClassMembership.class_id == Classroom.id,
            ClassMembership.user_id == user.id,
            ClassMembership.status == MembershipStatus.active,
        ),
    )
    if user.role != UserRole.admin:
        student = and_(
            ClassMembership.role == MembershipRole.student, Classroom.status != ClassStatus.draft
        )
        query = query.where(
            or_(student, ClassMembership.role == MembershipRole.teacher)
            if user.role == UserRole.teacher
            else student
        )
    if search.strip():
        query = query.where(service.search_filter([Classroom.code, Classroom.name], search.strip()))
    if status:
        query = query.where(Classroom.status == status)
    rows, total = await service.paginate(db, query.order_by(Classroom.id.desc()), page, page_size)
    return {
        "items": [
            service.class_response(
                row,
                user.role == UserRole.admin
                or (user.role == UserRole.teacher and role == MembershipRole.teacher),
            )
            for row, role in rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("", response_model=ClassResponse, status_code=201)
async def create_class(
    request: ClassCreate,
    user: User = Depends(require_system_role(UserRole.admin, UserRole.teacher)),
    db: AsyncSession = Depends(get_db),
):
    return await service.create_class(db, user, request)


@router.get("/{class_id}", response_model=ClassResponse)
async def get_class(access: ClassAccess = Depends(require_class_member())):
    return service.class_response(access.classroom, access.can_manage)


@router.patch("/{class_id}", response_model=ClassResponse)
async def patch_class(
    request: ClassPatch,
    access: ClassAccess = Depends(manage_class),
    db: AsyncSession = Depends(get_db),
):
    return await service.update_class(db, access, request.model_dump(exclude_unset=True))


@router.delete("/{class_id}", response_model=ClassResponse)
async def archive_class(
    access: ClassAccess = Depends(manage_class), db: AsyncSession = Depends(get_db)
):
    return await service.update_class(db, access, {"status": ClassStatus.archived})


@router.get("/{class_id}/members", response_model=MemberPage)
async def members(
    status: MembershipStatus = MembershipStatus.active,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    access: ClassAccess = Depends(read_members),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(ClassMembership, User)
        .join(User, User.id == ClassMembership.user_id)
        .where(
            ClassMembership.class_id == access.classroom.id,
            ClassMembership.status == status,
        )
        .order_by(ClassMembership.id)
    )
    rows, total = await service.paginate(db, query, page, page_size)
    return {
        "items": [service.member_response(row, user) for row, user in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/{class_id}/members", response_model=MemberResponse)
async def add_member(
    request: MemberAdd,
    access: ClassAccess = Depends(manage_class),
    db: AsyncSession = Depends(get_db),
):
    return await service.add_student(db, access, str(request.email))


@router.delete("/{class_id}/members", status_code=204)
async def remove_member(
    request: MemberRemove,
    access: ClassAccess = Depends(manage_class),
    db: AsyncSession = Depends(get_db),
):
    await service.remove_student(db, access, request.user_id)
    return Response(status_code=204)
