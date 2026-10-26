from typing import Literal

from pydantic import Field, model_validator

from app.schemas.classes import InputModel


class LessonEventInput(InputModel):
    idempotency_key: str = Field(min_length=8, max_length=128)
    kind: Literal["opened", "document_read", "video_segment", "video_confirmed"]
    start: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    end: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    position: float | None = Field(default=None, ge=0, allow_inf_nan=False)

    @model_validator(mode="after")
    def valid_event(self):
        if self.kind == "video_segment":
            if (
                self.start is None
                or self.end is None
                or self.end <= self.start
                or self.position is None
            ):
                raise ValueError("Đoạn video cần start, end, position hợp lệ.")
        elif any(value is not None for value in (self.start, self.end, self.position)):
            raise ValueError("Sự kiện này không nhận đoạn video hoặc vị trí.")
        return self


class SubmissionInput(InputModel):
    idempotency_key: str = Field(min_length=8, max_length=128)
    code: str = Field(min_length=1, max_length=262144)

    @model_validator(mode="after")
    def valid_code(self):
        if not self.code.strip() or len(self.code.encode("utf-8")) > 262144:
            raise ValueError("Mã nguồn phải khác rỗng và không quá 256 KiB UTF-8.")
        return self


class ReviewInput(InputModel):
    verdict: Literal["approved", "changes_requested"]
    feedback: str = Field(min_length=1, max_length=5000)


class OverrideInput(InputModel):
    idempotency_key: str = Field(min_length=8, max_length=128)
    membership_id: int = Field(gt=0)
    action: Literal["waive", "unlock"]
    reason: str = Field(min_length=5, max_length=1000)
    lesson_id: str | None = None
    lab_id: int | None = Field(default=None, ge=0, le=8)

    @model_validator(mode="after")
    def valid_target(self):
        if self.action == "waive" and (not self.lesson_id or self.lab_id is not None):
            raise ValueError("Miễn bài cần lesson_id.")
        if self.action == "unlock" and (self.lab_id is None or self.lesson_id is not None):
            raise ValueError("Mở khóa cần lab_id.")
        return self
