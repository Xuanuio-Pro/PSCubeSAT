"""Versioned curriculum identities and immutable published class snapshots."""

from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base

json_type = JSON().with_variant(JSONB(), "postgresql")


class Course(Base):
    __tablename__ = "courses"
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    title: Mapped[str] = mapped_column(Text)


class CourseVersion(Base):
    __tablename__ = "course_versions"
    __table_args__ = (
        UniqueConstraint("course_id", "version", name="uq_course_version"),
        CheckConstraint("status IN ('draft','published')", name="ck_course_version_status"),
    )
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id", ondelete="RESTRICT"))
    version: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(Text, server_default=text("'draft'"))
    source_hash: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Lab(Base):
    __tablename__ = "labs"
    __table_args__ = (
        UniqueConstraint("course_version_id", "order_no", name="uq_lab_order"),
        CheckConstraint("order_no BETWEEN 0 AND 8", name="ck_lab_order"),
    )
    course_version_id: Mapped[str] = mapped_column(
        ForeignKey("course_versions.id", ondelete="RESTRICT"), primary_key=True
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_no: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(Text)
    objectives: Mapped[str] = mapped_column(Text)
    estimated_minutes: Mapped[int] = mapped_column(Integer)
    groups: Mapped[list] = mapped_column(json_type)
    evidence: Mapped[str] = mapped_column(Text)


class Lesson(Base):
    __tablename__ = "lessons"
    __table_args__ = (
        ForeignKeyConstraint(
            ["course_version_id", "lab_id"],
            ["labs.course_version_id", "labs.id"],
            ondelete="RESTRICT",
        ),
        UniqueConstraint("course_version_id", "lab_id", "order_no", name="uq_lesson_order"),
        CheckConstraint("type IN ('video','document','practice','labtest')", name="ck_lesson_type"),
    )
    course_version_id: Mapped[str] = mapped_column(Text, primary_key=True)
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    lab_id: Mapped[int] = mapped_column(Integer)
    type: Mapped[str] = mapped_column(Text)
    order_no: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(Text)
    content: Mapped[dict] = mapped_column(json_type)
    completion_rule: Mapped[dict] = mapped_column(json_type)
    preview_allowed: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))


class ClassCourseVersion(Base):
    __tablename__ = "class_course_versions"
    __table_args__ = (
        CheckConstraint("status IN ('draft','published')", name="ck_class_course_status"),
    )
    class_id: Mapped[int] = mapped_column(
        ForeignKey("classes.id", ondelete="RESTRICT"), primary_key=True
    )
    version: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_version_id: Mapped[str] = mapped_column(
        ForeignKey("course_versions.id", ondelete="RESTRICT")
    )
    status: Mapped[str] = mapped_column(Text)
    lab_settings: Mapped[list] = mapped_column(json_type)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ClassLessonSetting(Base):
    __tablename__ = "class_lesson_settings"
    __table_args__ = (
        ForeignKeyConstraint(
            ["class_id", "version"],
            ["class_course_versions.class_id", "class_course_versions.version"],
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["course_version_id", "lesson_id"],
            ["lessons.course_version_id", "lessons.id"],
            ondelete="RESTRICT",
        ),
        CheckConstraint("status IN ('draft','published')", name="ck_class_lesson_status"),
    )
    class_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    version: Mapped[int] = mapped_column(Integer, primary_key=True)
    lesson_id: Mapped[str] = mapped_column(Text, primary_key=True)
    course_version_id: Mapped[str] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(Boolean)
    required: Mapped[bool] = mapped_column(Boolean)
    order_no: Mapped[int] = mapped_column(Integer)
    params: Mapped[dict] = mapped_column(json_type)
    status: Mapped[str] = mapped_column(Text)
