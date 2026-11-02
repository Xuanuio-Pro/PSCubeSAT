from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.models.curriculum import json_type

id_type = BigInteger().with_variant(Integer(), "sqlite")


class Prerequisite(Base):
    __tablename__ = "prerequisites"
    __table_args__ = (
        ForeignKeyConstraint(
            ["class_id", "version"],
            ["class_course_versions.class_id", "class_course_versions.version"],
            ondelete="RESTRICT",
        ),
        CheckConstraint("lab_id <> required_lab_id", name="ck_prerequisite_self"),
    )
    class_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    version: Mapped[int] = mapped_column(Integer, primary_key=True)
    lab_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    required_lab_id: Mapped[int] = mapped_column(Integer, primary_key=True)


class LessonProgress(Base):
    __tablename__ = "lesson_progress"
    __table_args__ = (
        UniqueConstraint("membership_id", "lesson_version", name="uq_member_lesson_version"),
        ForeignKeyConstraint(
            ["course_version_id", "lesson_id"],
            ["lessons.course_version_id", "lessons.id"],
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "status IN ('not_started','in_progress','pending_review','completed','waived')",
            name="ck_lesson_progress_status",
        ),
    )
    id: Mapped[int] = mapped_column(id_type, primary_key=True)
    membership_id: Mapped[int] = mapped_column(
        ForeignKey("class_memberships.id", ondelete="RESTRICT"), index=True
    )
    lesson_id: Mapped[str] = mapped_column(Text)
    lesson_version: Mapped[str] = mapped_column(Text)
    course_version_id: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, server_default="not_started")
    last_position: Mapped[float] = mapped_column(Float, server_default="0")
    watched_segments: Mapped[list] = mapped_column(json_type, default=list, server_default="[]")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ProgressEvent(Base):
    __tablename__ = "progress_events"
    __table_args__ = (Index("ix_progress_events_member_time", "membership_id", "created_at"),)
    idempotency_key: Mapped[str] = mapped_column(Text, primary_key=True)
    membership_id: Mapped[int] = mapped_column(
        ForeignKey("class_memberships.id", ondelete="RESTRICT")
    )
    lesson_version: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(Text)
    payload_hash: Mapped[str] = mapped_column(Text)
    response: Mapped[dict] = mapped_column(json_type)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CompletionOverride(Base):
    __tablename__ = "completion_overrides"
    id: Mapped[int] = mapped_column(id_type, primary_key=True)
    membership_id: Mapped[int] = mapped_column(
        ForeignKey("class_memberships.id", ondelete="RESTRICT"), index=True
    )
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="RESTRICT"))
    version: Mapped[int] = mapped_column(Integer)
    action: Mapped[str] = mapped_column(Text)
    lesson_version: Mapped[str | None] = mapped_column(Text)
    lab_id: Mapped[int | None] = mapped_column(Integer)
    actor: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PracticeSubmission(Base):
    __tablename__ = "practice_submissions"
    __table_args__ = (UniqueConstraint("progress_id", "revision", name="uq_submission_revision"),)
    id: Mapped[int] = mapped_column(id_type, primary_key=True)
    progress_id: Mapped[int] = mapped_column(
        ForeignKey("lesson_progress.id", ondelete="RESTRICT"), index=True
    )
    revision: Mapped[int] = mapped_column(Integer)
    code: Mapped[str] = mapped_column(Text)
    rubric_snapshot: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, server_default="pending_review")
    feedback: Mapped[str | None] = mapped_column(Text)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
