"""Lab 1 structure: ordered lessons, untouched practice ids, quiz slots without answers."""

import json
import unittest
from pathlib import Path

SEED = Path(__file__).resolve().parents[1] / "firmware" / "curriculum" / "seed.json"
PRACTICE = [
    "Lab1-01_Blink_LED",
    "Lab1-02_Control_Multiple_LEDs",
    "Lab1-03_PWM_LED",
    "Lab1-04_Button",
    "Lab1-05_LED_Button",
    "Lab1-06_7_Segment_LED",
    "Lab1-07_Serial_Communication",
    "Lab1-08_Serial_Control_LED",
    "Lab1-09_WiFi_Connection",
    "Lab1-10_WiFi_AP_Mode",
    "Lab1-11_Web_Server_LED",
]
PRACTICE_LESSONS = [
    "practice-1-led",
    "practice-1-button",
    "Lab1-06_7_Segment_LED",
    "practice-1-uart",
    "practice-1-wifi",
]


class Lab1ScaffoldTests(unittest.TestCase):
    def lessons(self):
        labs = json.loads(SEED.read_text("utf-8"))["labs"]
        return next(lab for lab in labs if lab["id"] == 1)["lessons"]

    def test_order_numbers_are_contiguous_and_labtest_is_last(self):
        lessons = self.lessons()
        self.assertEqual([item["order_no"] for item in lessons], list(range(len(lessons))))
        self.assertEqual(lessons[-1]["id"], "labtest-1")
        self.assertEqual(lessons[-1]["type"], "labtest")
        self.assertEqual(lessons[-2]["id"], "summary-1")

    def test_practice_ids_and_grouped_sub_exercises_are_kept_in_order(self):
        practice = [item for item in self.lessons() if item["type"] == "practice"]
        self.assertEqual([item["id"] for item in practice], PRACTICE_LESSONS)
        flattened = []
        for item in practice:
            exercises = item["content"].get("exercises")
            if exercises:
                flattened.extend(ex["id"] for ex in exercises)
            else:
                flattened.append(item["content"]["exercise_id"])
        self.assertEqual(flattened, PRACTICE)

    def test_has_thirteen_quiz_slots_eight_docs_three_videos(self):
        lessons = self.lessons()
        quizzes = [item["id"] for item in lessons if item["type"] == "quiz"]
        self.assertEqual(quizzes, [f"quiz-1-{n}" for n in range(1, 14)])
        docs = [
            item for item in lessons if item["type"] == "document" and item["id"] != "summary-1"
        ]
        self.assertEqual(len(docs), 8)
        self.assertTrue(all("markdown" in item["content"] for item in docs))
        self.assertEqual(len([item for item in lessons if item["type"] == "video"]), 3)

    def test_quiz_slots_are_disabled_and_answer_free(self):
        for item in self.lessons():
            if item["type"] != "quiz":
                continue
            self.assertFalse(item["default_enabled"])
            self.assertFalse(item["content"]["bank_ready"])
            self.assertNotIn("questions", item["content"])
            self.assertEqual(item["completion_rule"]["kind"], "quiz_pass")

    def test_each_practice_follows_its_group_quiz(self):
        ids = [item["id"] for item in self.lessons()]
        self.assertLess(ids.index("practice-1-led"), ids.index("quiz-1-4"))
        self.assertLess(ids.index("practice-1-button"), ids.index("quiz-1-6"))
        self.assertLess(ids.index("practice-1-wifi"), ids.index("quiz-1-13"))


if __name__ == "__main__":
    unittest.main()
