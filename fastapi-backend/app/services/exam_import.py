"""Exam parser (Text/Word-style, Excel .xlsx, CSV) and True/False prefix shuffling."""

import csv
import io
import re
import zipfile
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape

from app.services.student_import import _decode_bytes, _parse_xlsx_bytes

QUESTION_TYPE_ALIASES = {
    "single_choice": "single_choice",
    "single": "single_choice",
    "1": "single_choice",
    "i": "single_choice",
    "mot dap an": "single_choice",
    "một đáp án": "single_choice",
    "multiple_choice": "multiple_choice",
    "multiple": "multiple_choice",
    "2": "multiple_choice",
    "ii": "multiple_choice",
    "nhieu dap an": "multiple_choice",
    "nhiều đáp án": "multiple_choice",
    "true_false": "true_false",
    "tf": "true_false",
    "3": "true_false",
    "iii": "true_false",
    "dung sai": "true_false",
    "đúng sai": "true_false",
    "short_answer": "short_answer",
    "short": "short_answer",
    "4": "short_answer",
    "iv": "short_answer",
    "tra loi ngan": "short_answer",
    "trả lời ngắn": "short_answer",
}
PREFIX_RE = re.compile(r"^\s*\[\s*(\d+)\s*(?:,[^\]]*)?\]")


def resolve_question_type(raw: str | None) -> str:
    if not raw:
        return "single_choice"
    key = re.sub(r"\s+", " ", raw.strip().casefold())
    return QUESTION_TYPE_ALIASES.get(key, raw.strip())


def shuffle_true_false_choices(rng, choices: list[dict]) -> list[dict]:
    """Shuffle True/False statements respecting [0,1,2,...n] prefix ordering rules:
    - Order 0 may be placed at any position.
    - Equal order (>0) stay adjacent and shuffle freely among themselves.
    - Smaller order (>0) always appears before larger order (>0).
    """
    parsed = []
    has_prefix = False
    for item in choices:
        match = PREFIX_RE.match(item.get("text", ""))
        if match:
            has_prefix = True
            parsed.append((int(match.group(1)), item))
        else:
            parsed.append((0, item))
    if not has_prefix:
        copied = list(choices)
        rng.shuffle(copied)
        return copied

    zeros = [item for order, item in parsed if order == 0]
    rng.shuffle(zeros)
    groups: dict[int, list[dict]] = {}
    for order, item in parsed:
        if order > 0:
            groups.setdefault(order, []).append(item)

    blocks: list[list[dict]] = []
    for order in sorted(groups):
        group = list(groups[order])
        rng.shuffle(group)
        blocks.append(group)

    for zero_item in zeros:
        pos = rng.randint(0, len(blocks))
        blocks.insert(pos, [zero_item])

    return [item for block in blocks for item in block]


def parse_tabular_questions(rows: list[dict[str, str]]) -> list[dict]:
    data = []
    for row in rows:
        q_type = resolve_question_type(row.get("question_type") or row.get("type"))
        item = {
            "question_type": q_type,
            "prompt": (row.get("prompt") or "").strip(),
            "correct_choice_id": (row.get("correct_choice_id") or "").strip(),
            "explanation": (row.get("explanation") or "").strip(),
            "objective": (row.get("objective") or "").strip(),
            "difficulty": (row.get("difficulty") or "medium").strip() or "medium",
            "source_reference": (row.get("source_reference") or "").strip(),
            "choice_explanations": {
                choice_id: (row.get(f"explanation_{choice_id}") or "").strip()
                for choice_id in ("a", "b", "c", "d")
                if (row.get(f"explanation_{choice_id}") or "").strip()
            },
        }
        if q_type == "short_answer" and not any(
            (row.get(f"choice_{i}_text") or "").strip() for i in range(1, 5)
        ):
            item["choices"] = [
                {"id": cid, "text": f"Trả lời ngắn ({cid})"} for cid in ("a", "b", "c", "d")
            ]
        else:
            default_ids = ("a", "b", "c", "d")
            item["choices"] = [
                {
                    "id": (row.get(f"choice_{i}_id") or "").strip() or default_ids[i - 1],
                    "text": (row.get(f"choice_{i}_text") or "").strip(),
                }
                for i in range(1, 5)
            ]
        data.append(item)
    return data


def parse_xlsx_questions(content: str) -> list[dict]:
    raw_rows = _parse_xlsx_bytes(_decode_bytes(content))
    if len(raw_rows) < 2:
        return []
    headers = [cell.strip().lstrip("\ufeff") for cell in raw_rows[0]]
    dict_rows = []
    for row in raw_rows[1:]:
        if not any(cell.strip() for cell in row):
            continue
        dict_rows.append(
            {headers[idx]: (row[idx] if idx < len(row) else "") for idx in range(len(headers))}
        )
    return parse_tabular_questions(dict_rows)


def parse_csv_questions(content: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(content.lstrip("\ufeff")))
    return parse_tabular_questions(list(reader))


def _detect_section_type(header_line: str, part_num: str) -> str:
    lower = header_line.casefold()
    if "nhiều đáp án" in lower:
        return "multiple_choice"
    if "đúng sai" in lower or "đúng/sai" in lower:
        return "true_false"
    if "trả lời ngắn" in lower:
        return "short_answer"
    if "một đáp án" in lower or "nhiều phương án" in lower:
        return "single_choice"
    return {
        "I": "single_choice",
        "II": "multiple_choice",
        "III": "true_false",
        "IV": "short_answer",
    }.get(part_num.upper(), "single_choice")


def extract_docx_text(content: str) -> str:
    """Extract paragraphs and tables from a Word (.docx) archive (base64 or raw)."""
    raw_bytes = _decode_bytes(content)
    try:
        with zipfile.ZipFile(io.BytesIO(raw_bytes)) as zf:
            if "word/document.xml" not in zf.namelist():
                raise ValueError("Tệp Word (.docx) thiếu word/document.xml.")
            root = ET.fromstring(zf.read("word/document.xml"))
    except zipfile.BadZipFile as exc:
        raise ValueError("Tệp Word (.docx) không hợp lệ.") from exc

    body = root.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}body")
    if body is None:
        return ""
    lines: list[str] = []
    for child in body:
        tag = child.tag.split("}")[-1]
        if tag == "p":
            parts: list[str] = []
            for elem in child.iter():
                etag = elem.tag.split("}")[-1]
                if etag == "t" and elem.text:
                    parts.append(elem.text)
                elif etag == "tab":
                    parts.append("\t")
                elif etag in ("br", "cr"):
                    parts.append("\n")
            txt = "".join(parts)
            for subline in txt.splitlines():
                if subline.strip():
                    lines.append(subline.strip())
        elif tag == "tbl":
            for tr in child.iter():
                if tr.tag.split("}")[-1] != "tr":
                    continue
                cells: list[str] = []
                for tc in tr:
                    if tc.tag.split("}")[-1] != "tc":
                        continue
                    cell_text = "".join(
                        e.text or "" for e in tc.iter() if e.tag.split("}")[-1] == "t"
                    ).strip()
                    cells.append(cell_text)
                if any(cells):
                    lines.append("| " + " | ".join(cells) + " |")
    return "\n".join(lines)


def _parse_answer_text_block(
    answer_text: str,
) -> tuple[dict[tuple[str, int], str], dict[tuple[str, int], str], dict[int, tuple[str, str]]]:
    answer_keys: dict[tuple[str, int], str] = {}
    answer_explanations: dict[tuple[str, int], str] = {}
    by_index: dict[int, tuple[str, str]] = {}
    if not answer_text.strip():
        return answer_keys, answer_explanations, by_index

    current_part = "I"
    tf_columns: list[int] = []
    tf_map: dict[tuple[str, int], list[str]] = {}
    table_q_nums: list[int] = []
    seq_counter = 0

    for raw_line in answer_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        part_match = re.match(r"^PHẦN\s+([IVX\d]+)\b", line, re.IGNORECASE)
        if part_match:
            current_part = part_match.group(1).upper()
            tf_columns = []
            table_q_nums = []
            continue
        if line.startswith("|"):
            cells = [c.strip() for c in line.strip("|").split("|")]
            if not cells:
                continue
            first = cells[0].casefold()
            if first == "câu":
                table_q_nums = [int(c) for c in cells[1:] if c.isdigit()]
            elif first == "chọn" and table_q_nums:
                for q_num, val in zip(table_q_nums, cells[1:]):
                    if val.strip():
                        answer_keys[(current_part, q_num)] = val.strip()
            elif all(re.match(r"^câu\s+\d+$", c, re.IGNORECASE) for c in cells if c):
                tf_columns = [
                    int(re.search(r"\d+", c).group(0)) for c in cells if re.search(r"\d+", c)
                ]
            elif tf_columns:
                for q_num, cell in zip(tf_columns, cells):
                    m = re.match(r"^([a-d])\)\s*([ĐDSSTF])", cell, re.IGNORECASE)
                    if m:
                        cid = m.group(1).lower()
                        v = "Đ" if m.group(2).upper() in ("Đ", "D", "T") else "S"
                        tf_map.setdefault((current_part, q_num), []).append(f"{cid}:{v}")
            continue
        m_ans = re.match(r"^Câu\s+(\d+)\s*[.:]\s*(.+)$", line, re.IGNORECASE)
        if m_ans:
            q_num = int(m_ans.group(1))
            rest = m_ans.group(2).strip()
            if re.fullmatch(r"[A-Da-d](?:\s*[|,]\s*[A-Da-d])+", rest):
                answer_keys[(current_part, q_num)] = rest.lower()
            elif re.fullmatch(r"[ĐDSSTF]{4}|[A-Da-d]|-?\d+(?:[.,]\d+)?", rest, re.IGNORECASE):
                answer_keys[(current_part, q_num)] = rest
                seq_counter += 1
                by_index[q_num] = (rest, "")
            else:
                answer_explanations[(current_part, q_num)] = rest
    for key, pairs in tf_map.items():
        answer_keys[key] = "|".join(pairs)
    return answer_keys, answer_explanations, by_index


def parse_separate_answers(answer_format: str, answer_content: str) -> dict:
    """Parse a separate Answer File (.xlsx, .csv, .txt, .docx)."""
    by_index: dict[int, tuple[str, str, dict[str, str]]] = {}
    by_part: dict[tuple[str, int], tuple[str, str, dict[str, str]]] = {}

    if answer_format in ("text", "docx"):
        txt = extract_docx_text(answer_content) if answer_format == "docx" else answer_content
        split_marker = re.split(r"-{4,}\s*HẾT\s*-{4,}", txt, maxsplit=1, flags=re.IGNORECASE)
        target = split_marker[1] if len(split_marker) > 1 else txt
        keys, expls, idx_map = _parse_answer_text_block(target)
        for k, ans in keys.items():
            by_part[k] = (ans, expls.get(k, ""), {})
        by_index.update(
            {key: (answer, explanation, {}) for key, (answer, explanation) in idx_map.items()}
        )
        return {"by_index": by_index, "by_part": by_part}

    if answer_format == "xlsx":
        raw_rows = _parse_xlsx_bytes(_decode_bytes(answer_content))
    else:
        raw_rows = list(csv.reader(io.StringIO(answer_content.lstrip("\ufeff"))))

    if not raw_rows:
        return {"by_index": by_index, "by_part": by_part}

    # Check if row 0 / row 1 uses header names like Phần, Câu, Đáp án, Lời giải
    header_row = [str(c or "").strip().lstrip("\ufeff").casefold() for c in raw_rows[0]]
    part_col = next((i for i, h in enumerate(header_row) if h in ("phần", "phan", "part")), None)
    q_col = next(
        (i for i, h in enumerate(header_row) if h in ("câu", "cau", "câu hỏi", "cau hoi", "question", "stt")),
        0,
    )
    ans_col = next(
        (
            i
            for i, h in enumerate(header_row)
            if h in ("đáp án", "dap an", "chọn", "chon", "answer", "0001", "mã đề thi", "ma de thi")
        ),
        1,
    )
    expl_col = next(
        (
            i
            for i, h in enumerate(header_row)
            if h
            in (
                "lời giải",
                "loi giai",
                "giải thích",
                "giai thich",
                "explanation",
            )
        ),
        None,
    )
    explanation_cols = {
        letter: next(
            (
                i
                for i, h in enumerate(header_row)
                if h in (
                    f"giải thích {letter}",
                    f"giai thich {letter}",
                    f"explanation_{letter}",
                    f"explanation {letter}",
                )
            ),
            None,
        )
        for letter in ("a", "b", "c", "d")
    }

    seq_idx = 0
    for row in raw_rows[1:]:
        if not any(str(c or "").strip() for c in row):
            continue
        q_raw = str(row[q_col] if q_col < len(row) else "").strip()
        ans_raw = str(row[ans_col] if ans_col < len(row) else "").strip()
        if not q_raw and ans_raw in ("0001", "0002", "Đáp án", "Mã đề"):
            # Second header row in answers_test.xlsx (['', '0001', '0002', ...])
            continue
        m_num = re.search(r"\d+", q_raw)
        if not m_num or not ans_raw or ans_raw.casefold() in ("tự luận", "tu luan"):
            continue
        q_num = int(m_num.group(0))
        expl_raw = (
            str(row[expl_col]).strip()
            if expl_col is not None and expl_col < len(row) and row[expl_col]
            else ""
        )
        choice_explanations = {
            letter: str(row[index]).strip()
            for letter, index in explanation_cols.items()
            if index is not None and index < len(row) and str(row[index] or "").strip()
        }
        if part_col is not None and part_col < len(row) and str(row[part_col]).strip():
            part_val = re.sub(r"^phần\s*", "", str(row[part_col]).strip(), flags=re.IGNORECASE).upper()
            by_part[(part_val, q_num)] = (ans_raw, expl_raw, choice_explanations)
            seq_idx += 1
            by_index[seq_idx] = (ans_raw, expl_raw, choice_explanations)
        else:
            by_index[q_num] = (ans_raw, expl_raw, choice_explanations)

    return {"by_index": by_index, "by_part": by_part}


def merge_questions_and_answers(
    questions: list[dict],
    answer_format: str | None = None,
    answer_content: str | None = None,
) -> list[dict]:
    """Attach answers from a separate Answer File onto parsed questions."""
    answers = (
        parse_separate_answers(answer_format or "xlsx", answer_content)
        if answer_content and answer_content.strip()
        else None
    )
    merged: list[dict] = []
    for idx, item in enumerate(questions, start=1):
        q = dict(item)
        obj_match = re.match(
            r"^Phần\s+([IVX\d]+)\s*-\s*Câu\s+(\d+)",
            str(q.get("objective") or ""),
            re.IGNORECASE,
        )
        part = obj_match.group(1).upper() if obj_match else None
        num = int(obj_match.group(2)) if obj_match else None
        if answers:
            matched = None
            if part and num and (part, num) in answers["by_part"]:
                matched = answers["by_part"][(part, num)]
            elif idx in answers["by_index"]:
                matched = answers["by_index"][idx]
            elif num and num in answers["by_index"]:
                matched = answers["by_index"][num]
            if matched:
                ans_val, expl_val, choice_explanations = matched
                if ans_val:
                    q["correct_choice_id"] = ans_val
                if expl_val:
                    q["explanation"] = expl_val
                if choice_explanations:
                    q["choice_explanations"] = choice_explanations
        merged.append(q)
    return merged


def parse_docx_questions(content: str) -> list[dict]:
    return parse_exam_text(extract_docx_text(content))


def parse_exam_text(content: str) -> list[dict]:
    """Parse Vietnamese sample exam text (4-part standard exam or inline-answer format)."""
    text = content.lstrip("\ufeff").replace("\r\n", "\n")
    split_marker = re.split(r"-{4,}\s*HẾT\s*-{4,}", text, maxsplit=1, flags=re.IGNORECASE)
    body_text = split_marker[0]
    answer_text = split_marker[1] if len(split_marker) > 1 else ""

    answer_keys, answer_explanations, _ = _parse_answer_text_block(answer_text)

    # Parse questions in body_text
    current_part = "I"
    current_type = "single_choice"
    questions_raw: list[dict] = []
    current_q: dict | None = None
    in_explanation = False

    for raw_line in body_text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("(Giải thích tiền tố") or line.startswith("Khi đảo đáp án"):
            continue
        if line in (
            "Số thứ tự = 0 được ở bất kỳ vì trí nào",
            "Số thứ tự = 0 được ở bất kỳ vị trí nào",
            "Số thứ tự bằng nhau thì ở gần nhau và có thể đảo bất kỳ miễn là gần nhau",
        ) or line.startswith("Số thứ tự nhỏ hơn sẽ ở trước"):
            continue

        part_match = re.match(r"^PHẦN\s+([IVX\d]+)[.:]?\s*(.*)$", line, re.IGNORECASE)
        if part_match:
            if current_q:
                questions_raw.append(current_q)
                current_q = None
            current_part = part_match.group(1).upper()
            current_type = _detect_section_type(line, current_part)
            in_explanation = False
            continue

        q_match = re.match(r"^Câu\s+(\d+)[.:]\s*(.*)$", line, re.IGNORECASE)
        if q_match:
            if current_q:
                questions_raw.append(current_q)
            current_q = {
                "part": current_part,
                "num": int(q_match.group(1)),
                "question_type": current_type,
                "prompt_lines": [q_match.group(2).strip()] if q_match.group(2).strip() else [],
                "choices": [],
                "inline_correct": [],
                "explanation_lines": [],
                "inline_answer": "",
            }
            in_explanation = False
            continue

        if current_q is None:
            continue

        if re.match(r"^(Lời giải|Giải thích)\s*:?\s*$", line, re.IGNORECASE):
            in_explanation = True
            continue
        ans_inline = re.match(r"^Đáp án\s*:\s*(.+)$", line, re.IGNORECASE)
        if ans_inline:
            current_q["inline_answer"] = ans_inline.group(1).strip()
            in_explanation = True
            continue

        if in_explanation:
            current_q["explanation_lines"].append(line)
            continue

        # Check for A. B. C. D. on a single or multiple lines
        abcd_matches = list(
            re.finditer(
                r"(?:^|[\s\t])(\*|_)?([A-D])(?:\1)?\.\s*([^\t]+?)(?=(?:[\s\t]+(?:\*|_)?[A-D](?:\*|_)?\.\s)|$)",
                line,
            )
        )
        if abcd_matches and current_q["question_type"] in ("single_choice", "multiple_choice"):
            for m in abcd_matches:
                marked = bool(m.group(1))
                cid = m.group(2).lower()
                ctext = m.group(3).strip()
                current_q["choices"].append({"id": cid, "text": ctext})
                if marked:
                    current_q["inline_correct"].append(cid)
            continue

        # Check for a) b) c) d) statements for true_false
        tf_match = re.match(r"^(\*|_)?([a-d])(?:\1)?\)\s*(.+)$", line)
        if tf_match:
            current_q["question_type"] = "true_false"
            marked = bool(tf_match.group(1))
            cid = tf_match.group(2).lower()
            ctext = tf_match.group(3).strip()
            ans_suffix = re.search(r"\s*->\s*([ĐDSSTF])\s*$", ctext, re.IGNORECASE)
            if ans_suffix:
                ctext = ctext[: ans_suffix.start()].strip()
                v = "Đ" if ans_suffix.group(1).upper() in ("Đ", "D", "T") else "S"
                current_q["inline_correct"].append(f"{cid}:{v}")
            elif marked:
                current_q["inline_correct"].append(cid)
            # Ensure statement body after prefix [n, level] has distinct readable text even if OLE equation was stripped
            stripped_body = PREFIX_RE.sub("", ctext).strip()
            if stripped_body in ("", "."):
                ctext = f"{ctext.rstrip('.').strip()} Mệnh đề ({cid})"
            current_q["choices"].append({"id": cid, "text": ctext})
            continue

        current_q["prompt_lines"].append(line)

    if current_q:
        questions_raw.append(current_q)

    results: list[dict] = []
    for q in questions_raw:
        key_tuple = (q["part"], q["num"])
        q_type = q["question_type"]
        ans = q["inline_answer"] or answer_keys.get(key_tuple, "")
        if not ans and q["inline_correct"]:
            if q_type == "true_false" and all(":" in item for item in q["inline_correct"]):
                ans = "|".join(q["inline_correct"])
            elif q_type == "true_false":
                marked_set = set(q["inline_correct"])
                ans = "|".join(
                    f"{c['id']}:{'Đ' if c['id'] in marked_set else 'S'}" for c in q["choices"]
                )
            else:
                ans = "|".join(q["inline_correct"])

        explanation = (
            " ".join(q["explanation_lines"]).strip()
            or answer_explanations.get(key_tuple, "")
            or "Đã kiểm tra theo đáp án và hướng dẫn chấm của đề mẫu."
        )
        prompt = " ".join(q["prompt_lines"]).strip()
        results.append(
            {
                "question_type": q_type,
                "prompt": prompt,
                "choices": q["choices"],
                "correct_choice_id": ans,
                "explanation": explanation,
                "objective": f"Phần {q['part']} - Câu {q['num']}",
                "difficulty": "medium",
                "source_reference": f"Đề mẫu Phần {q['part']}",
            }
        )
    return results


SAMPLE_EXAM_TEXT = """PHẦN I. Câu trắc nghiệm một đáp án đúng
Câu 1. Mệnh đề toán học nào sau đây là mệnh đề sai?
A. Số 2 là số nguyên.	B. Số 2 là số hữu tỉ.
C. Số 2 là số hữu tỉ dương.	D. Số 2 không là số nguyên tố.

PHẦN II. Câu trắc nghiệm nhiều đáp án đúng
Câu 1. Trong các số sau, số nào là số hữu tỉ?
A. 3/4	B. -5	C. √2	D. 0,25
Câu 2. Cho hai đường thẳng song song. Trong các phát biểu sau, phát biểu nào đúng?
A. Hai góc so le trong bằng nhau	B. Hai góc đồng vị bằng nhau	C. Hai góc trong cùng phía bằng nhau	D. Hai góc trong cùng phía có tổng bằng 180°
Câu 3. Cho hai đại lượng tỉ lệ nghịch với nhau. Trong các phát biểu sau, phát biểu nào đúng?
A. Tích của hai đại lượng này luôn là một số không đổi	B. Thương của hai đại lượng này luôn là một số không đổi	C. Khi đại lượng này tăng lên thì đại lượng kia giảm xuống theo tỉ lệ tương ứng	D. Đồ thị biểu diễn mối quan hệ giữa hai đại lượng này là một đường thẳng đi qua gốc tọa độ

PHẦN III. Câu trắc nghiệm đúng sai.
Câu 1. Một cuộc thi bắn cung có 20 người tham gia. Trong lần bắn đầu tiên có 18 người bắn trúng mục tiêu. Trong lần bắn thứ hai có 15 người bắn trúng mục tiêu. Trong lần bắn thứ ba chỉ còn 10 người bắn trúng mục tiêu.
a) [1,NB] Số người bắn trượt mục tiêu trong lần đầu tiên là 2.
b) [1,NB] Số người bắn trượt mục tiêu trong lần bắn thứ hai là 6.
c) [0, TH] Số người bắn trượt mục tiêu trong lần bắn thứ nhất và thứ hai nhiều nhất là 8.
d) [2, TH] Số người bắn trúng mục tiêu trong cả ba lần bắn ít nhất là 3.
Câu 2. Cho tứ giác ABCD có M, N, P, Q lần lượt là trung điểm của các cạnh AB, BC, CD, DA. Gọi I là trung điểm của đoạn thẳng MP và G là trọng tâm tam giác BCD.
a) [1, NB] Vectơ AB + AD = AC.
b) [2, NB] Vectơ MN = PQ.
c) [2, TH] Vectơ IA + IB + IC + ID = 0.
d) [3, VD] Ba điểm A, I, G thẳng hàng.

PHẦN IV. Câu trắc nghiệm trả lời ngắn.
Câu 1. Cho hình chữ nhật ABCD có AB = 6, AD = 8. Độ dài của vectơ AB + AD bằng bao nhiêu?
Câu 2. Để đo khoảng cách từ vị trí A đến vị trí B ở hai bên bờ hồ, bạn Hà tiến hành đo khoảng cách AC và các góc BAC = 58°, BCA = 80° với AC = 20m. Khoảng cách từ vị trí A đến vị trí B là bao nhiêu mét (làm tròn kết quả đến hàng đơn vị của mét)?
---------------------------HẾT------------------------
PHẦN I
| Câu | 1 |
| Chọn | D |
Lời giải
Câu 1: D đúng vì 2 là số nguyên tố chẵn duy nhất.
PHẦN II
Câu 1. A|B|D
Câu 2. A|B|D
Câu 3. A|C
PHẦN III
| Câu 1 | Câu 2 |
| a) Đ | a) Đ |
| b) S | b) S |
| c) S | c) S |
| d) Đ | d) S |
Lời giải
Câu 1: a và d đúng theo nguyên lý cực trị tập hợp.
Câu 2: a đúng theo quy tắc hình bình hành.
PHẦN IV
| Câu | 1 | 2 |
| Chọn | 10 | 31 |
Lời giải
Câu 1: Độ dài vectơ tổng bằng AC = căn(6^2 + 8^2) = 10.
Câu 2: Áp dụng định lý sin trong tam giác ABC được AB xấp xỉ 31m.
"""


def sample_question_bank_xlsx() -> bytes:
    headers = (
        "question_type",
        "prompt",
        "choice_1_id",
        "choice_1_text",
        "choice_2_id",
        "choice_2_text",
        "choice_3_id",
        "choice_3_text",
        "choice_4_id",
        "choice_4_text",
        "correct_choice_id",
        "explanation",
        "objective",
        "difficulty",
        "source_reference",
    )
    rows = [
        headers,
        (
            "single_choice",
            "Mệnh đề toán học nào sau đây là mệnh đề sai?",
            "a",
            "Số 2 là số nguyên.",
            "b",
            "Số 2 là số hữu tỉ.",
            "c",
            "Số 2 là số hữu tỉ dương.",
            "d",
            "Số 2 không là số nguyên tố.",
            "d",
            "Số 2 là số nguyên tố chẵn duy nhất nên D sai.",
            "Phần I - Câu trắc nghiệm 1 đáp án",
            "easy",
            "Đề mẫu Phần I",
        ),
        (
            "multiple_choice",
            "Trong các số sau, số nào là số hữu tỉ?",
            "a",
            "3/4",
            "b",
            "-5",
            "c",
            "√2",
            "d",
            "0,25",
            "A|B|D",
            "3/4, -5 và 0,25 đều biểu diễn được dưới dạng phân số a/b.",
            "Phần II - Câu trắc nghiệm nhiều đáp án",
            "medium",
            "Đề mẫu Phần II",
        ),
        (
            "true_false",
            "Một cuộc thi bắn cung có 20 người tham gia (lần 1: 18 trúng, lần 2: 15 trúng, lần 3: 10 trúng).",
            "a",
            "[1,NB] Số người bắn trượt mục tiêu trong lần đầu tiên là 2.",
            "b",
            "[1,NB] Số người bắn trượt mục tiêu trong lần bắn thứ hai là 6.",
            "c",
            "[0, TH] Số người bắn trượt mục tiêu trong lần thứ nhất và thứ hai nhiều nhất là 8.",
            "d",
            "[2, TH] Số người bắn trúng mục tiêu trong cả ba lần bắn ít nhất là 3.",
            "ĐSSĐ",
            "Lần 1 trượt 2 (Đ), lần 2 trượt 5 (S), tổng trượt 1&2 tối đa 7 (S), cả 3 lần trúng ít nhất 3 (Đ).",
            "Phần III - Câu trắc nghiệm Đúng/Sai",
            "medium",
            "Đề mẫu Phần III",
        ),
        (
            "short_answer",
            "Cho hình chữ nhật ABCD có AB = 6, AD = 8. Độ dài của vectơ AB + AD bằng bao nhiêu?",
            "a",
            "Trả lời ngắn (a)",
            "b",
            "Trả lời ngắn (b)",
            "c",
            "Trả lời ngắn (c)",
            "d",
            "Trả lời ngắn (d)",
            "10",
            "Độ dài vectơ tổng bằng đường chéo AC = sqrt(6^2 + 8^2) = 10.",
            "Phần IV - Câu trả lời ngắn",
            "medium",
            "Đề mẫu Phần IV",
        ),
    ]
    col_letters = [chr(ord("A") + idx) for idx in range(len(headers))]
    row_xml = []
    for r_idx, row in enumerate(rows, start=1):
        cells = "".join(
            f'<c r="{col_letters[c_idx]}{r_idx}" t="inlineStr"><is><t>{escape(str(val))}</t></is></c>'
            for c_idx, val in enumerate(row)
        )
        row_xml.append(f'<row r="{r_idx}">{cells}</row>')

    sheet_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetData>{"".join(row_xml)}</sheetData>'
        "</worksheet>"
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        "</Types>"
    )
    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="xl/workbook.xml"/>'
        "</Relationships>"
    )
    workbook_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets><sheet name="QuestionBank" sheetId="1" r:id="rId1"/></sheets>'
        "</workbook>"
    )
    workbook_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
        'Target="worksheets/sheet1.xml"/>'
        "</Relationships>"
    )
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", root_rels)
        zf.writestr("xl/workbook.xml", workbook_xml)
        zf.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        zf.writestr("xl/worksheets/sheet1.xml", sheet_xml)
    return buffer.getvalue()


SAMPLE_QUESTION_ONLY_TEXT = SAMPLE_EXAM_TEXT.split("---------------------------HẾT------------------------")[0].strip()


def sample_question_docx() -> bytes:
    """Generate a separate Word (.docx) Question File containing only questions (Phần I–IV)."""
    p_xml = []
    for line in SAMPLE_QUESTION_ONLY_TEXT.splitlines():
        if not line.strip():
            continue
        p_xml.append(f"<w:p><w:r><w:t>{escape(line)}</w:t></w:r></w:p>")
    doc_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f'<w:body>{"".join(p_xml)}</w:body>'
        "</w:document>"
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="word/document.xml"/>'
        "</Relationships>"
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("word/document.xml", doc_xml)
    return buf.getvalue()


def sample_answer_xlsx() -> bytes:
    """Generate a separate Excel (.xlsx) Answer File matching SAMPLE_QUESTION_ONLY_TEXT."""
    rows = [
        ("Câu hỏi", "0001", "Phần", "Câu trong phần", "Lời giải", "Ghi chú định dạng"),
        ("1", "D", "I", "1", "Số 2 là số nguyên tố chẵn duy nhất nên D là mệnh đề sai.", "Trắc nghiệm 1 đáp án: A, B, C hoặc D"),
        ("2", "A|B|D", "II", "1", "3/4, -5 và 0,25 đều là số hữu tỉ.", "Nhiều đáp án: ngăn cách bởi dấu | (VD: A|B|D)"),
        ("3", "A|B|D", "II", "2", "Hai góc so le trong bằng nhau, đồng vị bằng nhau, trong cùng phía bù nhau.", ""),
        ("4", "A|C", "II", "3", "Hai đại lượng tỉ lệ nghịch có tích không đổi.", ""),
        ("5", "ĐSSĐ", "III", "1", "Lần 1 trượt 2 (Đ), lần 2 trượt 5 (S), tổng trượt <=7 (S), cả 3 lần trúng >=3 (Đ).", "Đúng/Sai 4 ý: nhập 4 ký tự Đ/S (VD: ĐSSĐ)"),
        ("6", "ĐSSS", "III", "2", "Ý a đúng theo quy tắc hình bình hành.", ""),
        ("7", "10", "IV", "1", "Độ dài vectơ tổng bằng đường chéo AC = sqrt(6^2 + 8^2) = 10.", "Trả lời ngắn: nhập số hoặc chuỗi ngắn"),
        ("8", "31", "IV", "2", "Áp dụng định lý sin trong tam giác ABC được AB xấp xỉ 31m.", ""),
    ]
    col_letters = [chr(ord("A") + idx) for idx in range(len(rows[0]))]
    row_xml = []
    for r_idx, row in enumerate(rows, start=1):
        cells = "".join(
            f'<c r="{col_letters[c_idx]}{r_idx}" t="inlineStr"><is><t>{escape(str(val))}</t></is></c>'
            for c_idx, val in enumerate(row)
        )
        row_xml.append(f'<row r="{r_idx}">{cells}</row>')

    sheet_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetData>{"".join(row_xml)}</sheetData>'
        "</worksheet>"
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        "</Types>"
    )
    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="xl/workbook.xml"/>'
        "</Relationships>"
    )
    workbook_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets><sheet name="Answers" sheetId="1" r:id="rId1"/></sheets>'
        "</workbook>"
    )
    workbook_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
        'Target="worksheets/sheet1.xml"/>'
        "</Relationships>"
    )
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", root_rels)
        zf.writestr("xl/workbook.xml", workbook_xml)
        zf.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        zf.writestr("xl/worksheets/sheet1.xml", sheet_xml)
    return buffer.getvalue()
