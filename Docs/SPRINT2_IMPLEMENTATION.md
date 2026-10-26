# Sprint 2 — Giáo trình có phiên bản và cấu hình lớp

Ngày 22/10/2026. Cơ sở: AGENTS.md, mục 4 và 7 của kế hoạch LMS và kiểm kê Sprint 1. Quyết định chi tiết trong [DECISIONS.md](DECISIONS.md).

## Kết quả và file thay đổi

| Nhóm | File chính | Kết quả |
|---|---|---|
| Dữ liệu | `fastapi-backend/app/models/curriculum.py`, import đăng ký ở `models/tables.py` | courses, course_versions, labs, lessons, class_course_versions, class_lesson_settings |
| Migration | `fastapi-backend/alembic/versions/0007_curriculum.py` | Khóa/FK/ràng buộc và trigger bảo vệ bản published khỏi sửa/xóa/thêm nội dung |
| Seed | `scripts/export-curriculum.mjs`, `app/services/curriculum_seed.py`, `app/firmware/curriculum/seed.json` | Đọc ba JS nguồn, chuẩn hóa, nhập snapshot xuất bản theo hash; chạy lặp không trùng |
| Cấu hình | `app/services/course_configuration.py`, `app/schemas/curriculum.py`, `app/routers/class_curriculum.py` | Nháp/xuất bản, revision, kiểm tra nội dung, phụ thuộc, dry-run số SV |
| Truy cập | `app/services/curriculum_access.py`, `app/routers/curriculum.py`, `compiler.py`, `application.py` | Membership/preview; lọc bài tắt, no-store, chặn API legacy khi flag bật, kiểm class/lesson/board trước compile |
| Compile | `app/services/progress.py` và test migration liên quan | Chỉ lưu compiled_at; không tạo completed_at cho Lab 1–8, giữ nguyên completed_at cũ |
| Giao diện | `src/pages/ClassCurriculumPage.jsx`, `ClassLearningPage.jsx`, `ClassDetailPage.jsx`, `src/components/classes/classes.css` | GV cấu hình theo lab/bài, lưu nháp, xem lỗi, dry-run, xuất bản; SV học nội dung qua API; xem thử không ghi tiến độ |
| Bundle | `vite.config.ts`, `src/data/lab-metadata.js`; các import ở Home/Profile/Header/Sidebar/LabLayout/LabWorkspace/Lab0/TelemetryContext | Tách nội dung seed khỏi toàn bộ module graph browser; chỉ metadata điều hướng công khai ở client |
| Tương thích | `DocViewer`, `CourseSidebar`, `LabLayout`, `auth-session.js`, `App.jsx` | Legacy flag tắt tải nội dung từ API; flag bật chuyển /labN sang lớp, giữ URL bài và đăng nhập quay lại đúng trang |
| Thực hành | `IDEPanel`, `BlocklyEditor`, `blockly-project.js`, `LabPracticeActions`, `CloudCompiler` | Bản nháp tách theo user/lớp/bài, giữ khóa legacy; biên dịch mang class_id/lesson_id và theo bo GV cấu hình |
| Kiểm thử | `app/tests/test_course_configuration.py`, `test_curriculum_postgres.py`, cập nhật `test_migrations.py`/`test_classes_postgres.py`, `tests/curriculum-seed.test.js`, `package.json` | Test seed, quyền, draft, validator, immutability, rollback, scope bản nháp và tuyến đăng nhập |

Đường dẫn `app/...` ở bảng thuộc `fastapi-backend/`. Ba file JS giáo trình gốc được giữ nguyên làm đầu vào seed; không đổi ID bài thực hành hay xóa dữ liệu cũ.

## Giáo trình sau seed

| Lab | Video | Document (gồm tổng kết) | Practice | Labtest | Tổng |
|---|---:|---:|---:|---:|---:|
| 0 | 1 | 1 | 1 | 1 | 4 |
| 1 | 3 | 4 | 6 | 1 | 14 |
| 2 | 2 | 3 | 3 | 1 | 9 |
| 3 | 2 | 2 | 3 | 1 | 8 |
| 4 | 5 | 3 | 9 | 1 | 18 |
| 5 | 3 | 3 | 5 | 1 | 12 |
| 6 | 4 | 5 | 2 | 1 | 12 |
| 7 | 2 | 3 | 3 | 1 | 9 |
| 8 | 2 | 3 | 1 | 1 | 7 |
| Tổng | 24 | 27 | 33 | 9 | 93 |

Giữ đủ **84 ID cũ**, trong đó **26 ID thực hành Lab 2–8**. `summary-N` giữ ID, chuyển thành document “Tổng kết”; `components` giữ ID, trở thành practice khám phá tùy chọn, được xem thử. Thêm `labtest-0` đến `labtest-8` dưới dạng slot disabled/optional vì chưa có ngân hàng đã duyệt.

Lab 2–8 có nhóm nội dung, thứ tự trong nhóm, mục tiêu và minh chứng đầu ra theo mục 4.2. Lab 6 được đặt tên “Cấu trúc và vận hành đa nhiệm”. Phần đã có được nhập từ nguồn; hướng dẫn thực hành/rubric/video còn thiếu có TODO cho GV. Không tạo lời giải, câu hỏi hoặc dữ kiện kỹ thuật mới để lấp chỗ trống. Giá trị estimated_minutes=0 ở lab hoặc null ở bài nghĩa là chưa ước lượng; GV bổ sung thời lượng ở từng bài.

Report máy đọc được từ lần chạy seed CLI trên DB thử: [SPRINT2_SEED_INVENTORY.json](SPRINT2_SEED_INVENTORY.json).

## Hợp đồng API

Tất cả endpoint yêu cầu tài khoản active. Endpoint lớp dùng membership/role từ DB mỗi request. Các API mới và preview yêu cầu `LMS_CLASS_MODE=true`.

| Method / URL | Hành vi |
|---|---|
| GET `/api/curriculum/versions` | Admin/GV xem phiên bản course đã xuất bản |
| GET `/api/classes/{class_id}/curriculum` | Bản published hiệu lực; SV chỉ nhận lab và bài enabled |
| GET cùng URL với `draft=true` | GV/Admin xem nháp, fallback bản published/template ban đầu |
| GET cùng URL với `draft=true&student_view=true` | GV xem nháp như SV, lọc bài tắt, không ghi event |
| PUT `/api/classes/{class_id}/settings` | GV/Admin lưu toàn bộ nháp; body `course_version_id`, `expected_version`, `labs`, `lessons` |
| POST `/api/classes/{class_id}/publish?dry_run=true` | Body `expected_version`; validate và trả `affected_students`, không thay đổi bản hiệu lực |
| POST `/api/classes/{class_id}/publish` | Kiểm lại revision/validator rồi xuất bản, audit cùng transaction |
| GET `/api/curriculum/preview` | Tài khoản trải nghiệm chỉ nhận lesson `preview_allowed` từ course published |
| GET `/api/curriculum/exercises?class_id=...` | Chỉ liệt kê mã mẫu thuộc bài đang bật mà user có quyền |
| GET `/api/curriculum/exercises/{exercise_id}/source?class_id=...` | Kiểm membership và bài enabled trước trả file; không có class_id chỉ được preview_allowed |
| GET `/api/curriculum/legacy` | Chỉ khi flag tắt; phục vụ luồng cũ qua API có auth, không bundle học liệu |

Mỗi `labs` input: `{lab_id, enabled, prerequisites: [lab_id...]}`. Mỗi `lessons` input: `{lesson_id, enabled, required, order_no, params}`. Danh sách phải đủ, đúng phiên bản và không lặp. `params` được allowlist theo loại; từ chối trường đáp án/câu hỏi, URL không an toàn và kiểu dữ liệu sai.

Response curriculum có class_id, course_version_id, version, status, can_manage và các lab/bài. Nội dung hiệu lực là content gốc kết hợp params của revision; SV không nhận TODO quản trị. Payload nội dung được lọc trường, không có đáp án test. Bản published cũ giữ nguyên khi có draft mới. Lưu nháp dùng revision tăng; expected_version sai trả 409 VERSION_CONFLICT. Course version của lớp đã xuất bản không được tự đổi trong luồng này.

Validator trả 422 CONFIG_INVALID cùng `details.errors[]`, gồm code/message và lab_id/lesson_id khi có:

- CONTENT_MISSING: video bắt buộc thiếu URL HTTPS, document thiếu Markdown, practice thiếu hướng dẫn/rubric, labtest chưa có ngân hàng sẵn sàng.
- NO_REQUIRED_LESSON: lab bật nhưng không có bài enabled + required.
- DISABLED_PREREQUISITE: lab bật phụ thuộc lab đã tắt/không tồn tại.
- PREREQUISITE_CYCLE, DUPLICATE_ORDER, NO_ENABLED_LAB và lỗi danh sách/tham số.

## Chạy migration và seed

```powershell
# Từ root; export luôn kiểm tra lại nguồn JS.
npm run curriculum:export
npm run db:migrate
npm run curriculum:seed

# Hoặc trong fastapi-backend, dùng snapshot đã export:
node ../scripts/python.mjs -m alembic upgrade head
node ../scripts/python.mjs -m app.services.curriculum_seed --report ../Docs/seed-report.json
```

Seed có transaction và advisory lock trên PostgreSQL. Cùng source hash trả lại cùng version; nguồn thay đổi tạo version mới, không sửa version published. File seed.json được giữ trong backend để container không cần Node khi nhập DB. `npm run test:curriculum` kiểm snapshot không bị lệch ba JS nguồn và script chuyển đổi.

Sau migration/seed, bật `LMS_CLASS_MODE=true` và khởi động lại backend. GV mở `/classes/{id}/curriculum`, lưu nháp lần đầu để gắn lớp với course đã published; không tự gán course cho mọi lớp. Chọn ít nhất một yêu cầu có nội dung thật cho mỗi lab bật; Lab 0 chưa có tài liệu thật nên cần bổ sung hoặc tắt lab. Kiểm tra trước xuất bản, xem số SV và xác nhận. SV mở `/classes/{id}/learn`; tài khoản trải nghiệm dùng `/preview`.

Migration 0007 downgrade giữ nguyên schema, snapshot và trigger để không mất dữ liệu hoặc mở lại quyền sửa published; chỉ lùi revision. Đã thử downgrade -1 → upgrade head trên DB riêng. Không áp dụng migration/seed vào DB ứng dụng thật trong lượt này.

## Kiểm chứng

- `npm run check`: đạt lint, TypeScript, schema, 115 test Node và backend discovery (127 test, 12 skip theo môi trường).
- Pytest với `PSCUBESAT_TEST_POSTGRES=1`: **125 passed, 2 skipped** (hai bài tích hợp Docker compiler).
- PostgreSQL thật: schema khớp ORM, course/lesson/lab/config đã published không sửa/xóa được bằng SQL, draft có thể sửa và xuất bản đúng thứ tự; rollback giữ 93 bài và nhập lại không trùng.
- CLI độc lập trên DB sạch: upgrade head; chạy seed hai lần, report giống nhau; downgrade/upgrade và đối chiếu schema. Không dùng DB đang phục vụ ứng dụng.
- Test API: đủ ba lỗi validator yêu cầu; SV không nhận bài tắt, không tải được source của bài tắt; nháp/dry-run không đổi response SV; mất membership bị chặn; trải nghiệm chỉ nhận preview_allowed; JWT cũ không vượt quyền; compile kiểm lớp/bài và không gọi lưu hoàn thành.
- Build Vite có guard chặn import ba module seed vào browser graph. Kiểm tra production assets không có các đoạn READING_NOTES gốc. Không phụ thuộc một cờ build frontend để giữ kín học liệu khi bật flag runtime.
- UI trên DB SQLite giả lập: GV mở Lab 2, bật video bắt buộc thiếu URL → lưu nháp được nhưng xuất bản bị chặn; sửa lại → dry-run thấy 1 SV → xuất bản thành công; xem như SV ghi rõ không ghi tiến độ; SV tải tài liệu từ API và thấy danh sách loại trừ video/test đang tắt.

Log local: `scratch/sprint2-check.log`, `sprint2-build.log`, `sprint2-pytest.log`, `sprint2-cli.log`. Ảnh giao diện: `scratch/sprint2-publish-preview.png`; dữ liệu trong ảnh là dữ liệu thử.

## Giới hạn và việc tiếp nối

Các TODO học liệu cần GV duyệt/bổ sung. Slot labtest có cấu hình nhưng chưa có engine thi/ngân hàng, nên không đặt bắt buộc cho đến sprint kiểm tra. Chưa triển khai tiến độ từng bài hoặc mở khóa học thực tế trong sprint này; không có event hoàn thành từ trang học/xem thử. Compile không còn tạo hoàn thành mới; lịch sử cũ được giữ.

Rollback dùng flag và giữ schema forward-compatible, không hạ về binary không hiểu các model/role mới. Chưa thử flash phần cứng trong lượt này; kiểm thử compiler/flash/telemetry hiện có đã chạy, hai test Docker thực và kiểm chứng thiết bị cần môi trường tương ứng. Build còn cảnh báo chunk lớn của thư viện editor/trực quan.
