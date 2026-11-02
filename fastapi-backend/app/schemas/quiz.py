import re
import unicodedata
from datetime import datetime
from typing import Literal

from pydantic import Field, model_validator

from app.schemas.classes import InputModel


def normalized(value):
    return re.sub(r"\W+", " ", unicodedata.normalize("NFKC", value).casefold()).strip()


class Choice(InputModel):
    id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,64}$")
    text: str = Field(min_length=1, max_length=2000)


class QuestionInput(InputModel):
    prompt: str = Field(min_length=10, max_length=5000)
    choices: list[Choice] = Field(min_length=4, max_length=4)
    correct_choice_id: str
    explanation: str = Field(min_length=5, max_length=5000)
    objective: str = Field(min_length=3, max_length=500)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    source_reference: str = Field(min_length=3, max_length=2000)

    @model_validator(mode="after")
    def valid_choices(self):
        for name in ("prompt", "explanation", "objective", "source_reference"):
            if not normalized(getattr(self, name)):
                raise ValueError("Không được để trống nội dung bắt buộc.")
        ids = [choice.id for choice in self.choices]
        values = [normalized(choice.text) for choice in self.choices]
        if len(set(ids)) != 4 or len(set(values)) != 4 or not all(values):
            raise ValueError("Cần bốn lựa chọn khác nhau và ID không trùng.")
        if self.correct_choice_id not in ids:
            raise ValueError("Đáp án đúng phải là ID của một lựa chọn.")
        return self


class RevisionInput(InputModel):
    expected_revision: int = Field(ge=1)


class QuestionEdit(RevisionInput):
    question: QuestionInput


class QuestionReview(RevisionInput):
    status: Literal["approved", "draft", "retired"]


class BankFork(RevisionInput):
    reason: str = Field(min_length=5, max_length=1000)
    retire_question_id: str | None = None


class ImportInput(RevisionInput):
    format: Literal["json", "csv"]
    content: str = Field(min_length=2, max_length=300000)


class PolicyInput(RevisionInput):
    num_questions: Literal[5] = 5
    time_limit_minutes: int = Field(default=10, ge=1, le=180)
    pass_score: int = Field(default=4, ge=1, le=5)
    max_attempts: int = Field(default=3, ge=1, le=100)
    score_rule: Literal["highest"] = "highest"
    reveal_policy: Literal["after_attempts", "after_close", "immediate", "never"] = "after_attempts"
    closes_at: datetime | None = None

    @model_validator(mode="after")
    def close_time(self):
        if self.closes_at and self.closes_at.tzinfo is None:
            raise ValueError("Thời điểm đóng cần múi giờ.")
        if self.reveal_policy == "after_close" and self.closes_at is None:
            raise ValueError("Cần thời điểm đóng đợt kiểm tra.")
        return self


class StartInput(InputModel):
    idempotency_key: str = Field(min_length=8, max_length=128)


class AnswersInput(StartInput):
    expected_revision: int = Field(ge=0)
    answers: dict[str, str] = Field(max_length=5)


class GrantInput(StartInput):
    membership_id: int = Field(gt=0)
    extra_attempts: int = Field(ge=1, le=20)
    reason: str = Field(min_length=5, max_length=1000)


class GenerationInput(RevisionInput):
    lesson_ids: list[str] = Field(min_length=1, max_length=20)
    count: int = Field(default=5, ge=1, le=20)
