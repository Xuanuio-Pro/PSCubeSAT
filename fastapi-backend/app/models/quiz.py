"""Private question versions and immutable examination snapshots."""

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.models.curriculum import json_type


class QuestionBank(Base):
    __tablename__ = "question_banks"
    __table_args__ = (
        UniqueConstraint("class_id", "lab_id", "version", name="uq_bank_version"),
        ForeignKeyConstraint(
            ["course_version_id", "lab_id"],
            ["labs.course_version_id", "labs.id"],
            ondelete="RESTRICT",
        ),
        CheckConstraint("status IN ('draft','published')", name="ck_bank_status"),
    )
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="RESTRICT"))
    course_version_id: Mapped[str] = mapped_column(Text)
    lab_id: Mapped[int] = mapped_column(Integer)
    version: Mapped[int] = mapped_column(Integer)
    revision: Mapped[int] = mapped_column(Integer, server_default="1")
    status: Mapped[str] = mapped_column(Text, server_default="draft")
    reason: Mapped[str] = mapped_column(Text, server_default="")
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    published_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class QuestionVersion(Base):
    __tablename__ = "question_versions"
    __table_args__ = (
        UniqueConstraint("bank_id", "question_id", name="uq_bank_question"),
        CheckConstraint("status IN ('draft','approved','retired')", name="ck_question_status"),
    )
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    bank_id: Mapped[str] = mapped_column(
        ForeignKey("question_banks.id", ondelete="RESTRICT"), index=True
    )
    question_id: Mapped[str] = mapped_column(Text)
    content: Mapped[dict] = mapped_column(json_type)
    status: Mapped[str] = mapped_column(Text, server_default="draft")
    reviewer: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class QuizPolicy(Base):
    __tablename__ = "quiz_policies"
    __table_args__ = (
        CheckConstraint(
            "num_questions=5 AND pass_score BETWEEN 1 AND 5 AND time_limit_minutes BETWEEN 1 AND 180 AND max_attempts BETWEEN 1 AND 100",
            name="ck_quiz_policy",
        ),
    )
    class_id: Mapped[int] = mapped_column(
        ForeignKey("classes.id", ondelete="RESTRICT"), primary_key=True
    )
    lab_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bank_id: Mapped[str | None] = mapped_column(
        ForeignKey("question_banks.id", ondelete="RESTRICT")
    )
    revision: Mapped[int] = mapped_column(Integer, server_default="1")
    num_questions: Mapped[int] = mapped_column(Integer, server_default="5")
    time_limit_minutes: Mapped[int] = mapped_column(Integer, server_default="10")
    pass_score: Mapped[int] = mapped_column(Integer, server_default="4")
    max_attempts: Mapped[int] = mapped_column(Integer, server_default="3")
    score_rule: Mapped[str] = mapped_column(Text, server_default="highest")
    reveal_policy: Mapped[str] = mapped_column(Text, server_default="after_attempts")
    closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    __table_args__ = (
        UniqueConstraint("membership_id", "lesson_version", "number", name="uq_quiz_number"),
        Index(
            "uq_quiz_active",
            "membership_id",
            "lesson_version",
            unique=True,
            postgresql_where=text("status='active'"),
            sqlite_where=text("status='active'"),
        ),
        CheckConstraint("status IN ('active','submitted','expired')", name="ck_attempt_status"),
    )
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="RESTRICT"), index=True)
    membership_id: Mapped[int] = mapped_column(
        ForeignKey("class_memberships.id", ondelete="RESTRICT")
    )
    lab_id: Mapped[int] = mapped_column(Integer)
    lesson_id: Mapped[str] = mapped_column(Text)
    lesson_version: Mapped[str] = mapped_column(Text)
    course_version_id: Mapped[str] = mapped_column(Text)
    bank_id: Mapped[str] = mapped_column(ForeignKey("question_banks.id", ondelete="RESTRICT"))
    number: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(Text, server_default="active")
    policy: Mapped[dict] = mapped_column(json_type)
    answer_revision: Mapped[int] = mapped_column(Integer, server_default="0")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revealed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    score: Mapped[int | None] = mapped_column(Integer)


class QuizAttemptItem(Base):
    __tablename__ = "quiz_attempt_items"
    __table_args__ = (
        UniqueConstraint("attempt_id", "position", name="uq_attempt_position"),
        UniqueConstraint("attempt_id", "question_version_id", name="uq_attempt_question"),
    )
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    attempt_id: Mapped[str] = mapped_column(
        ForeignKey("quiz_attempts.id", ondelete="RESTRICT"), index=True
    )
    question_version_id: Mapped[str] = mapped_column(
        ForeignKey("question_versions.id", ondelete="RESTRICT")
    )
    position: Mapped[int] = mapped_column(Integer)
    snapshot: Mapped[dict] = mapped_column(json_type)


class QuizAnswer(Base):
    __tablename__ = "quiz_answers"
    attempt_id: Mapped[str] = mapped_column(
        ForeignKey("quiz_attempts.id", ondelete="RESTRICT"), primary_key=True
    )
    item_id: Mapped[str] = mapped_column(
        ForeignKey("quiz_attempt_items.id", ondelete="RESTRICT"), primary_key=True
    )
    choice_id: Mapped[str] = mapped_column(Text)


class QuizRequest(Base):
    __tablename__ = "quiz_requests"
    idempotency_key: Mapped[str] = mapped_column(Text, primary_key=True)
    membership_id: Mapped[int] = mapped_column(
        ForeignKey("class_memberships.id", ondelete="RESTRICT")
    )
    attempt_id: Mapped[str] = mapped_column(ForeignKey("quiz_attempts.id", ondelete="RESTRICT"))
    payload_hash: Mapped[str] = mapped_column(Text)
    revision: Mapped[int] = mapped_column(Integer, server_default="0")


class QuizAttemptGrant(Base):
    __tablename__ = "quiz_attempt_grants"
    idempotency_key: Mapped[str] = mapped_column(Text, primary_key=True)
    membership_id: Mapped[int] = mapped_column(
        ForeignKey("class_memberships.id", ondelete="RESTRICT")
    )
    lesson_version: Mapped[str] = mapped_column(Text)
    extra_attempts: Mapped[int] = mapped_column(Integer)
    actor: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class QuestionGenerationJob(Base):
    __tablename__ = "question_generation_jobs"
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    bank_id: Mapped[str] = mapped_column(ForeignKey("question_banks.id", ondelete="RESTRICT"))
    actor: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    bank_revision: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(Text, server_default="queued")
    sources: Mapped[list] = mapped_column(json_type)
    count: Mapped[int] = mapped_column(Integer)
    tries: Mapped[int] = mapped_column(Integer, server_default="0")
    reserved_microusd: Mapped[int] = mapped_column(Integer, server_default="0")
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class QuestionGenerationBudget(Base):
    __tablename__ = "question_generation_budgets"
    day: Mapped[str] = mapped_column(Text, primary_key=True)
    reserved_microusd: Mapped[int] = mapped_column(Integer, server_default="0")
