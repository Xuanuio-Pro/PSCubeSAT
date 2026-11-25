"""Server-only sample question bank loader for class quizzes and Lab Tests.

Resolution order for `(lab_id, lesson_id)`:
1. Per-lesson file: `lab{lab_id}/{lesson_id}.csv` then `.json` (all questions).
2. Per-lab type file: `lab{lab_id}/labtest.csv|.json` (all questions) or
   `lab{lab_id}/quiz.csv|.json` (rotating 3-question slice per `quiz_index`).
3. Global fallback: `default-question-bank.csv` (10 questions for Lab Test,
   rotating 3-question slice per `quiz_index` for lesson quizzes).

Empty placeholder files (such as `{"questions": []}`) fall through to the next level.
"""

import json
from copy import deepcopy
from functools import lru_cache
from pathlib import Path

from app.schemas.quiz import QuestionInput, normalized
from app.services.exam_import import parse_csv_questions

CURRICULUM_DIR = Path(__file__).resolve().parents[1] / "firmware" / "curriculum"
DEFAULT_BANK_FILENAME = "default-question-bank.csv"

DEFAULT_POLICIES = {
    "quiz": {
        "num_questions": 5,
        "pass_score": 4,
        "time_limit_minutes": 10,
        "max_attempts": None,
        "cooldown_minutes": 0,
    },
    "labtest": {
        "num_questions": 20,
        "pass_score": 16,
        "time_limit_minutes": 20,
        "max_attempts": 5,
        "cooldown_minutes": 30,
    },
}


LEGACY_GENERIC_PROMPT_TEXTS = (
    "CPU là viết tắt của cụm từ nào?",
    "Thiết bị nào sau đây là thiết bị đầu vào (input)?",
    "1 byte bằng bao nhiêu bit?",
    "Số nhị phân 1010 có giá trị bằng bao nhiêu trong hệ thập phân?",
    "Phần mềm nào sau đây là hệ điều hành?",
    "Giao thức nào thường dùng để truyền tải trang web an toàn (có mã hóa)?",
    "Trong Excel, hàm nào dùng để tính tổng các giá trị trong một vùng ô?",
    "Địa chỉ IP nào sau đây là địa chỉ IPv4 hợp lệ?",
    "Cấu trúc dữ liệu nào hoạt động theo nguyên tắc vào trước ra trước (FIFO)?",
    "Độ phức tạp thời gian của thuật toán tìm kiếm nhị phân trên mảng đã sắp xếp gồm n phần tử là gì?",
)


def is_legacy_generic_prompt(prompt: str | None) -> bool:
    """Return True if a prompt belongs to the retired generic CPU/RAM/IPv4 fallback bank."""
    if not prompt:
        return False
    return normalized(prompt) in {normalized(item) for item in LEGACY_GENERIC_PROMPT_TEXTS}


def default_policy(kind: str, sample_count: int | None = None) -> dict[str, int | None]:
    """Return default QuizPolicy values for a lesson quiz or Lab Test."""
    base = dict(DEFAULT_POLICIES["labtest" if kind == "labtest" else "quiz"])
    if sample_count is not None and sample_count > 0:
        draw = min(int(base["num_questions"]), sample_count)
        base["num_questions"] = draw
        if draw < int(base["pass_score"]):
            base["pass_score"] = max(1, draw)
    return base


@lru_cache(maxsize=64)
def _load_validated_file(path_str: str, _mtime_ns: int, _size: int) -> tuple[dict, ...]:
    path = Path(path_str)
    text = path.read_text(encoding="utf-8-sig")
    if path.suffix.lower() == ".csv":
        raw = parse_csv_questions(text)
    elif path.suffix.lower() == ".json":
        parsed = json.loads(text)
        raw = parsed.get("questions", []) if isinstance(parsed, dict) else parsed
        if not isinstance(raw, list):
            raise ValueError(f"Expected list of questions in {path}")
    else:
        raise ValueError(f"Unsupported sample question file format: {path.suffix}")
    return tuple(QuestionInput.model_validate(item).model_dump() for item in raw)


def _read_if_present(path: Path) -> list[dict]:
    if not path.is_file():
        return []
    stat = path.stat()
    return [
        deepcopy(item) for item in _load_validated_file(str(path), stat.st_mtime_ns, stat.st_size)
    ]


def _take_rotating_quiz(pool: list[dict], quiz_index: int, count: int = 3) -> list[dict]:
    if not pool:
        return []
    if len(pool) <= count:
        return deepcopy(pool)
    start = (quiz_index * count) % len(pool)
    return [deepcopy(pool[(start + offset) % len(pool)]) for offset in range(count)]


def sample_questions_for(
    lab_id: int,
    lesson_id: str,
    *,
    quiz_index: int = 0,
    curriculum_dir: Path | None = None,
) -> list[dict]:
    """Load validated sample questions for a quiz or Lab Test from server-only files."""
    root = curriculum_dir or CURRICULUM_DIR
    lab_dir = root / f"lab{lab_id}"
    kind = "labtest" if lesson_id.startswith("labtest-") else "quiz"

    # 1. Per-lesson override (.csv then .json)
    for ext in (".csv", ".json"):
        items = _read_if_present(lab_dir / f"{lesson_id}{ext}")
        if items:
            return items

    # 2. Per-lab type override (.csv then .json)
    for ext in (".csv", ".json"):
        items = _read_if_present(lab_dir / f"{kind}{ext}")
        if items:
            return items if kind == "labtest" else _take_rotating_quiz(items, quiz_index)

    # 3. Global 10-question CSV fallback
    pool = _read_if_present(root / DEFAULT_BANK_FILENAME)
    if not pool:
        return []
    if kind == "labtest":
        return deepcopy(pool[:10])
    return _take_rotating_quiz(pool, quiz_index)
