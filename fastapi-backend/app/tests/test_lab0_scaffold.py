"""Lab 0 scaffold: quiz slots are a valid, disabled-by-default, answer-free lesson type."""

import json
import unittest
from pathlib import Path
from types import SimpleNamespace

from app.models.curriculum import Lesson
from app.services.course_configuration import ALLOWED_PARAMS, defaults, safe_content

SEED = Path(__file__).resolve().parents[1] / "firmware" / "curriculum" / "seed.json"
LAB0_ORDER = [
    "overview",
    "document",
    "quiz-0-1",
    "document-0-2",
    "quiz-0-2",
    "video-0-2",
    "components",
    "quiz-0-3",
    "summary-0",
    "labtest-0",
]


class Lab0ScaffoldTests(unittest.TestCase):
    def lab0(self):
        return next(lab for lab in json.loads(SEED.read_text("utf-8"))["labs"] if lab["id"] == 0)

    def test_lab0_has_the_ten_ordered_slots(self):
        lessons = self.lab0()["lessons"]
        self.assertEqual([item["id"] for item in lessons], LAB0_ORDER)
        self.assertEqual([item["order_no"] for item in lessons], list(range(len(LAB0_ORDER))))
        self.assertEqual(lessons[-1]["type"], "labtest")

    def test_quiz_type_is_allowed_by_the_model_constraint(self):
        constraint = next(
            c for c in Lesson.__table__.constraints if getattr(c, "name", "") == "ck_lesson_type"
        )
        self.assertIn("'quiz'", str(constraint.sqltext))
        self.assertIn("quiz", ALLOWED_PARAMS)

    def test_quiz_and_labtest_are_enabled_and_required_by_default(self):
        for kind, order_no in (("quiz", 2), ("labtest", 9)):
            lesson = SimpleNamespace(type=kind, content={}, order_no=order_no)
            self.assertEqual(
                defaults(lesson),
                {"enabled": True, "required": True, "order_no": order_no, "params": {}},
            )

    def test_quiz_content_never_exposes_answers(self):
        content = {"bank_key": "quiz-0-1", "bank_ready": False, "questions": [{"answer": "a"}]}
        self.assertEqual(safe_content(content, "quiz"), {"bank_ready": False})
        for lesson in self.lab0()["lessons"]:
            self.assertNotIn("questions", lesson["content"])

    def test_quiz_cannot_be_completed_by_a_client_click(self):
        # The `complete` event only accepts these types (learning_progress.py).
        source = (
            Path(__file__).resolve().parents[1] / "services" / "learning_progress.py"
        ).read_text("utf-8")
        self.assertIn('not in {"document", "video", "practice", "labtest"}', source)


if __name__ == "__main__":
    unittest.main()
