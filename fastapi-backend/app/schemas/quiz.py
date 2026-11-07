import re
import unicodedata
from datetime import datetime
from typing import Literal

from pydantic import Field, model_validator

from app.schemas.classes import InputModel


def normalized(value):
    return re.sub(r"\W+", " ", unicodedata.normalize("NFKC", value).casefold()).strip()


def normalize_short_answer(value: str) -> str:
    text = unicodedata.normalize("NFKC", value or "").strip()
    if re.fullmatch(r"[-+]?\d+,\d+", text):
        text = text.replace(",", ".")
    if re.fullmatch(r"[-+]?\d+\.\d+", text):
        text = text.rstrip("0").rstrip(".") if "." in text else text
    return text


def normalize_true_false_answer(raw: str, valid_ids: list[str], *, partial: bool = False) -> str:
    text = (raw or "").strip()
    mapping: dict[str, str] = {}
    compact = re.sub(r"[\s,;|-]+", "", text).upper()
    if len(compact) == len(valid_ids) and all(ch in "ĐDSTF10" for ch in compact):
        for cid, ch in zip(valid_ids, compact):
            mapping[cid] = "Đ" if ch in "ĐDT1" else "S"
    else:
        for part in [p.strip() for p in re.split(r"[|,;]", text) if p.strip()]:
            if ":" not in part and "=" not in part:
                raise ValueError("Đáp án Đúng/Sai phải có dạng ĐSĐS hoặc a:Đ|b:S|c:Đ|d:S.")
            key, val = re.split(r"[:=]", part, maxsplit=1)
            cid = key.strip().lower()
            v = val.strip().upper()
            if cid not in valid_ids or v not in {"Đ", "D", "T", "TRUE", "1", "S", "F", "FALSE", "0"}:
                raise ValueError("Đáp án Đúng/Sai không hợp lệ.")
            mapping[cid] = "Đ" if v in {"Đ", "D", "T", "TRUE", "1"} else "S"
    if not partial and set(mapping.keys()) != set(valid_ids):
        raise ValueError("Cần chọn đủ Đúng/Sai cho cả 4 ý a, b, c, d.")
    if not mapping:
        raise ValueError("Đáp án Đúng/Sai không được để trống.")
    return "|".join(f"{cid}:{mapping[cid]}" for cid in sorted(mapping))


def normalize_multiple_choice_answer(raw: str, valid_ids: list[str]) -> str:
    parts = [p.strip() for p in re.split(r"[|,;\s]+", (raw or "").strip()) if p.strip()]
    if not parts:
        raise ValueError("Chọn ít nhất một đáp án đúng.")
    lower_map = {cid.lower(): cid for cid in valid_ids}
    matched: list[str] = []
    for part in parts:
        cid = part if part in valid_ids else lower_map.get(part.lower())
        if not cid or cid in matched:
            raise ValueError("Đáp án nhiều lựa chọn chứa ID không hợp lệ hoặc bị trùng.")
        matched.append(cid)
    return "|".join(sorted(matched))


class Choice(InputModel):
    id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,64}$")
    text: str = Field(min_length=1, max_length=2000)


class QuestionInput(InputModel):
    question_type: Literal["single_choice", "multiple_choice", "true_false", "short_answer"] = (
        "single_choice"
    )
    prompt: str = Field(min_length=10, max_length=5000)
    choices: list[Choice] = Field(default_factory=list, max_length=4)
    correct_choice_id: str = Field(min_length=1, max_length=256)
    explanation: str = Field(default="Đã kiểm tra theo đáp án chuẩn.", min_length=5, max_length=5000)
    objective: str = Field(default="Kiểm tra kiến thức Lab", min_length=3, max_length=500)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    source_reference: str = Field(default="Tài liệu Lab", min_length=3, max_length=2000)

    @model_validator(mode="after")
    def valid_choices(self):
        for name in ("prompt", "explanation", "objective", "source_reference"):
            if not normalized(getattr(self, name)):
                raise ValueError("Không được để trống nội dung bắt buộc.")
        if self.question_type == "short_answer":
            if not self.choices:
                self.choices = [
                    Choice(id=cid, text=f"Trả lời ngắn ({cid})") for cid in ("a", "b", "c", "d")
                ]
            ids = [choice.id for choice in self.choices]
            if len(set(ids)) != 4:
                raise ValueError("Cần giữ đủ 4 ID lựa chọn nội bộ cho câu trả lời ngắn.")
            ans = normalize_short_answer(self.correct_choice_id)
            if not ans or len(ans) > 64:
                raise ValueError("Đáp án trả lời ngắn không được để trống (tối đa 64 ký tự).")
            self.correct_choice_id = ans
            return self

        if len(self.choices) != 4:
            raise ValueError("Cần đủ bốn lựa chọn cho câu hỏi trắc nghiệm.")
        ids = [choice.id for choice in self.choices]
        values = [normalized(choice.text) for choice in self.choices]
        if len(set(ids)) != 4 or len(set(values)) != 4 or not all(values):
            raise ValueError("Cần bốn lựa chọn khác nhau và ID không trùng.")

        if self.question_type == "single_choice":
            lower_map = {cid.lower(): cid for cid in ids}
            if self.correct_choice_id not in ids:
                mapped = lower_map.get(self.correct_choice_id.lower())
                if not mapped:
                    raise ValueError("Đáp án đúng phải là ID của một lựa chọn.")
                self.correct_choice_id = mapped
        elif self.question_type == "multiple_choice":
            self.correct_choice_id = normalize_multiple_choice_answer(self.correct_choice_id, ids)
        elif self.question_type == "true_false":
            self.correct_choice_id = normalize_true_false_answer(self.correct_choice_id, ids)
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
    format: Literal["json", "csv", "xlsx", "text"]
    content: str = Field(min_length=2, max_length=1500000)


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
