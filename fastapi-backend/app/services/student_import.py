"""Bulk student import (CSV and Excel .xlsx) and template generation for classes."""

import base64
import csv
import io
import re
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, timezone
from xml.sax.saxutils import escape

from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import func, select

from app.core.lms_errors import LMSError
from app.models.tables import (
    AccountStatus,
    ClassMembership,
    MembershipRole,
    MembershipStatus,
    User,
)
from app.schemas.classes import MemberImportResponse, MemberImportSkip
from app.services.classes import audit

MAX_IMPORT_BYTES = 1_000_000
MAX_UNZIPPED_BYTES = 5_000_000
MAX_IMPORT_ROWS = 500
EMAIL_ADAPTER = TypeAdapter(EmailStr)

EMAIL_HEADERS = {
    "email",
    "e-mail",
    "gmail",
    "email sinh vien",
    "email sinh viên",
    "thu dien tu",
    "thư điện tử",
}
NAME_HEADERS = {
    "full_name",
    "fullname",
    "name",
    "ho ten",
    "họ tên",
    "ho va ten",
    "họ và tên",
    "ten sinh vien",
    "tên sinh viên",
}
SAMPLE_ROWS = (
    ("email", "full_name"),
    ("student1@gmail.com", "Nguyễn Văn A"),
    ("student2@gmail.com", "Trần Thị B"),
)


def _invalid(message: str, details: dict | None = None):
    raise LMSError(422, "CONFIG_INVALID", message, details or {})


def _normalize_header(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").lstrip("\ufeff").strip().casefold())


def _safe_xml(data: bytes) -> ET.Element:
    head = data[:4096].upper()
    if b"<!DOCTYPE" in head or b"<!ENTITY" in head:
        _invalid("Tệp Excel không hợp lệ hoặc chứa cấu trúc XML bị từ chối.")
    try:
        return ET.fromstring(data)
    except ET.ParseError as exc:
        _invalid("Không đọc được cấu trúc tệp Excel (.xlsx).")
        raise exc


def _col_index(cell_ref: str, fallback: int) -> int:
    match = re.match(r"^([A-Za-z]+)", cell_ref or "")
    if not match:
        return fallback
    col = 0
    for char in match.group(1).upper():
        col = col * 26 + (ord(char) - ord("A") + 1)
    return col - 1


def _decode_bytes(content: str) -> bytes:
    raw = content.strip()
    if "," in raw and raw.lower().startswith("data:"):
        raw = raw.split(",", 1)[1]
    try:
        data = base64.b64decode(raw, validate=True)
    except ValueError as exc:
        _invalid("Nội dung tệp tải lên không đúng định dạng base64.")
        raise exc
    if len(data) > MAX_IMPORT_BYTES:
        _invalid("Kích thước tệp vượt quá giới hạn 1 MB.")
    return data


def _parse_xlsx_bytes(data: bytes) -> list[list[str]]:
    if len(data) > MAX_IMPORT_BYTES:
        _invalid("Kích thước tệp vượt quá giới hạn 1 MB.")
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        _invalid("Tệp Excel (.xlsx) bị hỏng hoặc không đúng định dạng.")
        raise exc

    with archive:
        total_size = sum(info.file_size for info in archive.infolist())
        if total_size > MAX_UNZIPPED_BYTES:
            _invalid("Tệp Excel vượt quá giới hạn dung lượng giải nén.")
        names = set(archive.namelist())
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in names:
            sst = _safe_xml(archive.read("xl/sharedStrings.xml"))
            for si in sst.iter():
                if si.tag.endswith("}si") or si.tag == "si":
                    parts = [
                        node.text or ""
                        for node in si.iter()
                        if node.tag.endswith("}t") or node.tag == "t"
                    ]
                    shared_strings.append("".join(parts))

        sheet_name = "xl/worksheets/sheet1.xml"
        if sheet_name not in names:
            sheets = sorted(
                n for n in names if n.startswith("xl/worksheets/") and n.endswith(".xml")
            )
            if not sheets:
                _invalid("Tệp Excel không có trang tính (worksheet) nào.")
            sheet_name = sheets[0]

        sheet = _safe_xml(archive.read(sheet_name))
        rows: list[list[str]] = []
        for row_el in sheet.iter():
            if not (row_el.tag.endswith("}row") or row_el.tag == "row"):
                continue
            cells: dict[int, str] = {}
            next_col = 0
            for cell_el in row_el:
                if not (cell_el.tag.endswith("}c") or cell_el.tag == "c"):
                    continue
                col_idx = _col_index(cell_el.attrib.get("r", ""), next_col)
                next_col = col_idx + 1
                cell_type = cell_el.attrib.get("t", "")
                val = ""
                if cell_type == "inlineStr":
                    val = "".join(
                        node.text or ""
                        for node in cell_el.iter()
                        if node.tag.endswith("}t") or node.tag == "t"
                    )
                else:
                    v_el = next(
                        (
                            child
                            for child in cell_el
                            if child.tag.endswith("}v") or child.tag == "v"
                        ),
                        None,
                    )
                    raw_val = (v_el.text or "") if v_el is not None else ""
                    if cell_type == "s" and raw_val.isdigit():
                        idx = int(raw_val)
                        val = shared_strings[idx] if 0 <= idx < len(shared_strings) else ""
                    else:
                        val = raw_val
                cells[col_idx] = val.strip()
            max_col = max(cells.keys(), default=-1)
            rows.append([cells.get(i, "") for i in range(max_col + 1)])
        return rows


def _parse_csv_content(content: str) -> list[list[str]]:
    if len(content.encode("utf-8", errors="ignore")) > MAX_IMPORT_BYTES:
        _invalid("Kích thước tệp vượt quá giới hạn 1 MB.")
    text = content.lstrip("\ufeff")
    first_line = text.splitlines()[0] if text.splitlines() else ""
    delimiter = ";" if ";" in first_line and "," not in first_line else ","
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    return [[(cell or "").strip() for cell in row] for row in reader]


def parse_student_rows(fmt: str, content: str) -> list[tuple[int, str, str | None]]:
    if fmt == "xlsx":
        raw_rows = _parse_xlsx_bytes(_decode_bytes(content))
    else:
        raw_rows = _parse_csv_content(content)

    if not raw_rows:
        _invalid("Tệp không có dữ liệu sinh viên để nhập.")

    header = [_normalize_header(cell) for cell in raw_rows[0]]
    email_col = next((idx for idx, name in enumerate(header) if name in EMAIL_HEADERS), None)
    name_col = next((idx for idx, name in enumerate(header) if name in NAME_HEADERS), None)
    if email_col is None:
        _invalid("Tệp thiếu cột email. Vui lòng tải mẫu Excel/CSV và giữ nguyên tiêu đề cột.")

    parsed: list[tuple[int, str, str | None]] = []
    for row_number, row in enumerate(raw_rows[1:], start=2):
        email = row[email_col].strip() if email_col < len(row) else ""
        full_name = (
            row[name_col].strip() if name_col is not None and name_col < len(row) else ""
        )
        if not email and not full_name:
            continue
        parsed.append((row_number, email, full_name or None))

    if not parsed:
        _invalid("Tệp không có dòng dữ liệu sinh viên nào.")
    if len(parsed) > MAX_IMPORT_ROWS:
        _invalid(f"Mỗi lần chỉ nhập tối đa {MAX_IMPORT_ROWS} sinh viên.")
    return parsed


async def import_students(db, access, request) -> MemberImportResponse:
    rows = parse_student_rows(request.format, request.content)
    seen_emails: set[str] = set()
    added_count = 0
    restored_count = 0
    already_active_count = 0
    skipped: list[MemberImportSkip] = []

    for row_num, raw_email, full_name in rows:
        email = raw_email.strip().lower()
        if not email:
            skipped.append(
                MemberImportSkip(
                    row=row_num,
                    email="",
                    full_name=full_name,
                    code="EMPTY_EMAIL",
                    reason="Thiếu địa chỉ email.",
                )
            )
            continue
        try:
            email = str(EMAIL_ADAPTER.validate_python(email)).lower()
        except ValidationError:
            skipped.append(
                MemberImportSkip(
                    row=row_num,
                    email=raw_email,
                    full_name=full_name,
                    code="INVALID_EMAIL",
                    reason="Định dạng email không hợp lệ.",
                )
            )
            continue

        if email in seen_emails:
            skipped.append(
                MemberImportSkip(
                    row=row_num,
                    email=email,
                    full_name=full_name,
                    code="DUPLICATE_IN_FILE",
                    reason="Email bị trùng trong cùng tệp nhập.",
                )
            )
            continue
        seen_emails.add(email)

        user = (
            await db.execute(
                select(User).where(
                    func.lower(User.email) == email,
                    User.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if user is None:
            skipped.append(
                MemberImportSkip(
                    row=row_num,
                    email=email,
                    full_name=full_name,
                    code="NOT_REGISTERED",
                    reason="Email chưa có tài khoản. Sinh viên cần đăng ký trước.",
                )
            )
            continue
        if user.status != AccountStatus.active:
            skipped.append(
                MemberImportSkip(
                    row=row_num,
                    email=email,
                    full_name=full_name or user.full_name,
                    code="ACCOUNT_LOCKED",
                    reason="Tài khoản này đang bị khóa.",
                )
            )
            continue

        membership = (
            await db.execute(
                select(ClassMembership).where(
                    ClassMembership.class_id == access.classroom.id,
                    ClassMembership.user_id == user.id,
                )
            )
        ).scalar_one_or_none()
        if membership and membership.role != MembershipRole.student:
            skipped.append(
                MemberImportSkip(
                    row=row_num,
                    email=email,
                    full_name=full_name or user.full_name,
                    code="IS_TEACHER",
                    reason="Tài khoản đã là giảng viên của lớp.",
                )
            )
            continue
        if membership and membership.status == MembershipStatus.active:
            already_active_count += 1
            continue

        before = {"status": membership.status} if membership else None
        if membership is None:
            membership = ClassMembership(
                class_id=access.classroom.id,
                user_id=user.id,
                role=MembershipRole.student,
            )
            db.add(membership)
        membership.status = MembershipStatus.active
        membership.added_by = access.user.id
        membership.added_at = datetime.now(timezone.utc)
        membership.removed_at = None
        await db.flush()
        audit(
            db,
            access.user.id,
            "member.restore" if before else "member.add",
            f"membership:{membership.id}",
            before,
            {"status": membership.status, "class_id": membership.class_id, "user_id": user.id},
        )
        if before:
            restored_count += 1
        else:
            added_count += 1

    await db.commit()
    return MemberImportResponse(
        total_rows=len(rows),
        added_count=added_count,
        restored_count=restored_count,
        already_active_count=already_active_count,
        skipped_count=len(skipped),
        skipped=skipped,
    )


def student_template_csv() -> str:
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")
    for row in SAMPLE_ROWS:
        writer.writerow(row)
    return "\ufeff" + output.getvalue()


def student_template_xlsx() -> bytes:
    row_xml = []
    for r_idx, (col_a, col_b) in enumerate(SAMPLE_ROWS, start=1):
        row_xml.append(
            f'<row r="{r_idx}">'
            f'<c r="A{r_idx}" t="inlineStr"><is><t>{escape(col_a)}</t></is></c>'
            f'<c r="B{r_idx}" t="inlineStr"><is><t>{escape(col_b)}</t></is></c>'
            f"</row>"
        )
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
        '<sheets><sheet name="Students" sheetId="1" r:id="rId1"/></sheets>'
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
