from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.services.auth import get_required_user
from app.services.permissions import ClassAccess, require_class_member, require_lms_enabled
from app.services.reports import class_report, report_csv

router = APIRouter(
    prefix="/api/classes/{class_id}",
    tags=["reports"],
    dependencies=[Depends(get_required_user), Depends(require_lms_enabled)],
)
teacher = require_class_member(roles=["teacher"])


@router.get("/reports")
async def reports(
    format: Literal["json", "csv"] = Query(default="json"),
    access: ClassAccess = Depends(teacher),
    db: AsyncSession = Depends(get_db),
):
    report = await class_report(db, access)
    if format == "json":
        return report
    return Response(
        report_csv(report),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="class-{access.classroom.id}-report.csv"',
            "Cache-Control": "no-store",
        },
    )
