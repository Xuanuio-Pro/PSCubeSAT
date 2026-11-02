# Checklist nghiệm thu (kế hoạch mục 11)

Ngày đối chiếu: 26/10/2026, sau Sprint 5. Trạng thái: **Đạt** = có test tự động/bằng chứng chạy được và đã qua; **Một phần** = phần tự động đạt, còn bước phải làm trên môi trường/thiết bị thật; **Chưa đạt** = chưa có bằng chứng.

Test backend ở `fastapi-backend/app/tests/` (ký hiệu `file::test`); test frontend ở `tests/`. Test `*_postgres.py` chạy trên PostgreSQL thật với Alembic CLI khi `PSCUBESAT_TEST_POSTGRES=1`. Lệnh và kết quả lượt chạy cuối: mục [Kết quả chạy](#kết-quả-chạy).

## Bảng mục 11

| Nhóm | Tình huống | Trạng thái | Bằng chứng |
|---|---|---|---|
| Phân quyền | User không tự nâng role | Đạt | `test_classes::test_register_rejects_role_and_status`, `test_role_claim_cannot_grant_admin_and_demotion_is_immediate` (JWT ghi role giả không có tác dụng) |
| | GV lớp A không xem/sửa lớp B | Đạt | `test_classes::test_teacher_cannot_read_or_write_another_class`; `test_reports::test_report_contents_csv_injection_and_scope` (GV lớp B nhận 403 khi đọc báo cáo lớp A) |
| | SV không lấy bài/điểm người khác | Đạt | `test_classes::test_student_cannot_manage_or_list_other_students`; `test_quizzes::test_authorization_versioning_and_revision_conflicts`; `test_reports` (SV 403 với báo cáo); `test_e2e::test_admin_teacher_student_report_flow` |
| | Gọi API trực tiếp vẫn bị chặn | Đạt | Toàn bộ test trên gọi HTTP API thật (không override quyền), kể cả Admin-only `PATCH /api/admin/classes/{id}/lms-mode` (GV nhận 403) |
| Thu hồi | Xóa SV/khóa tài khoản chặn token và tab cũ | Đạt | `test_classes::test_membership_idempotency_removal_old_token_and_restore`, `test_locked_user_rejected_by_all_authenticated_http_routes`, `test_google_and_socket_reject_locked_account`; `test_learning::test_revoked_member_and_archived_class_cannot_write` |
| | Lưu bài đang thi tuân thủ chính sách thu hồi | Đạt | `test_quizzes::test_background_expiry_without_student_request` (hết giờ worker chấm theo đáp án đã lưu, API từ chối người mất quyền — DECISIONS Lab Test) |
| Cấu hình | Tắt video/docs/practice/test không deadlock | Đạt | `test_learning::test_unlock_not_completion_and_disabled_recalculates`, `test_two_classes_overrides_and_disabled_denominator`; `test_course_configuration::test_disabled_filtered_and_draft_isolation_dry_run` |
| | Không còn yêu cầu, phụ thuộc bị tắt, chu trình bị từ chối | Đạt | `test_course_configuration::test_cycles_and_empty_labs_are_invalid`, `test_publish_collects_all_three_required_errors` |
| Tiến độ | Mở trang không hoàn thành video | Đạt | `test_learning::test_video_open_union_and_manual_policy` |
| | Compile đơn thuần không hoàn thành lab | Đạt | `test_course_configuration::test_compile_requires_enabled_membership_and_never_completes`, `test_learning::test_default_path_and_content_source_compile_gates`; `test_reports` (lịch sử `compiled_at` cũ không tính hoàn thành) |
| | Sự kiện lặp không tăng tiến độ | Đạt | `test_learning::test_document_open_event_idempotency_and_legacy_block`; `test_learning_postgres::test_concurrent_events_submissions_and_retained_rollback` (6 request cùng key → 1 event) |
| | Tải lại vẫn đúng | Đạt | Tiến độ chỉ tính ở server; các test đọc lại `learning-path` sau mỗi bước. Lượt thi: `test_quizzes::test_end_to_end_refresh_double_submit_and_private_answers` |
| Nhiều lớp | Cùng SV hai lớp, không dùng chéo tiến độ/điểm | Đạt | `test_learning::test_two_classes_overrides_and_disabled_denominator`; `test_reports::test_lab_entry_one_many_none` (link cũ cho chọn lớp, tiến độ tách) |
| Thực hành | Nộp đúng ngữ cảnh, GV chấm rubric, SV xem nhận xét, chờ chấm chưa mở khóa | Đạt | `test_learning::test_pending_review_does_not_unlock_and_teacher_approves`; `test_learning_postgres` (nộp đồng thời 1 revision, bản cũ không chấm được) |
| Đề thi | 20 câu đã duyệt | Đạt | `test_quizzes::test_seed_empty_and_publish_requires_exact_20` (0/19/21 → `BANK_NOT_READY`); `test_e2e` (nhập + duyệt + xuất bản qua API) |
| | 5 câu không trùng/đề | Đạt | `test_quizzes::test_end_to_end_refresh_double_submit_and_private_answers`; unique `(attempt_id, question_version_id)`; tải 300 SV: 1 500 câu cho 300 lượt |
| | Không lộ đáp án | Đạt | Response khi làm bài không có `correct_choice_id`/giải thích (`test_quizzes`, `test_e2e`). Đáp án chỉ lưu trong DB; frontend không chứa dữ liệu câu hỏi (mẫu import để trống đáp án). Chưa có test tự quét bundle |
| | Refresh giữ đề | Đạt | `test_quizzes::test_end_to_end_refresh_double_submit_and_private_answers`; `test_quizzes_postgres::test_races_snapshot_guards_and_rollback` |
| | Ngân hàng thay đổi không sửa lượt cũ | Đạt | `test_quizzes::test_authorization_versioning_and_revision_conflicts`; `test_quizzes_postgres` (trigger DB từ chối sửa snapshot/điểm đã chốt) |
| Đồng thời | Double-click bắt đầu/nộp, hai tab | Đạt | `test_quizzes_postgres::test_races_snapshot_guards_and_rollback`; [LOAD_TEST.md](LOAD_TEST.md): 300 SV × 2 lệnh bắt đầu và 2 lệnh nộp → 300 lượt, 300 sự kiện chấm |
| | Hết giờ, nộp muộn, hết lượt | Đạt | `test_quizzes::test_expiry_late_answers_limit_and_reveal`, `test_extra_attempts_reveal_close_and_highest_score`, `test_background_expiry_without_student_request` |
| | Mất mạng | Một phần | Logic cache/gửi lại: `tests/quiz-storage.test.js` (3 test). Chưa thử ngắt mạng trên trình duyệt thật trong Sprint 5 |
| | Lưu đáp án sát giờ dưới tải cao | Một phần | Dữ liệu nhất quán dưới tải, nhưng request xếp hàng quá hạn bị từ chối — rủi ro 1 trong [LOAD_TEST.md](LOAD_TEST.md), cần quyết định nghiệp vụ |
| Phiên bản | Sửa nháp không đổi lớp đang học | Đạt | `test_course_configuration::test_disabled_filtered_and_draft_isolation_dry_run`; `test_curriculum_postgres::test_database_rejects_published_edits_and_drafts_stay_isolated` |
| | Chuyển phiên bản không tự xóa kết quả | Đạt | `test_learning_postgres::test_backfill_keeps_old_published_path`; kết quả gắn `lesson_version` (DECISIONS Sprint 3). Không cho đổi course version sau lần xuất bản đầu |
| | Ngưỡng đạt cũ lưu với lượt thi | Đạt | Policy chụp vào `quiz_attempts.policy`; `test_quizzes::test_extra_attempts_reveal_close_and_highest_score`, trigger trong `test_quizzes_postgres` |
| Hồi quy | Đăng nhập | Đạt | `test_auth` (đăng ký/đăng nhập, Google, đổi mật khẩu, thu hồi phiên), `tests/auth-storage.test.js` |
| | C++/Blockly | Đạt | `tests/blockly.test.js` (24 test) |
| | Compiler, tải artifact | Một phần | `test_compiler` (12 test), `test_compiler_sandbox` (5 test chạy; 2 test Docker thật opt-in chưa chạy), `tests/flash-artifact.test.js` |
| | Flash | Một phần | `tests/flash-artifact.test.js` (offset, hash, chip mismatch, MD5) — chưa nạp board thật trong Sprint 5 |
| | Telemetry | Một phần | `test_platform`, `test_telemetry_wire`, `test_mqtt_runtime`, `tests/telemetry.test.js` — chưa nhận telemetry từ thiết bị thật trong Sprint 5 |
| | Với người dùng có quyền | Đạt | Compile trong lớp: `test_learning::test_default_path_and_content_source_compile_gates`; user ngoài pilot giữ đường cũ: `test_course_configuration::test_no_membership_legacy_source_and_preview_boundaries` |
| Di chuyển | Mapping ID đúng | Đạt | `test_legacy_migration::test_report_maps_ids_and_changes_nothing`; diễn tập bản sao DB local: 84/84 ID ([MIGRATION_REHEARSAL_2026-10-26.json](MIGRATION_REHEARSAL_2026-10-26.json)) |
| | Dữ liệu legacy giữ nguyên | Đạt | `test_classes_postgres::test_cli_upgrade_legacy_preservation_and_retained_downgrade`, `test_migrations::test_legacy_upgrade_preserves_existing_rows`; `test_legacy_migration::test_dry_run_then_apply_is_explicit_and_idempotent` (lab_progress không đổi, không tạo tiến độ LMS); diễn tập 0005 → 0010 giữ `users`/`lab_progress` |
| | Phục hồi được sau rollback | Đạt | Mọi `*_postgres` test chạy `downgrade -1` → `upgrade head` và so schema với ORM; `test_e2e_postgres` giữ `lms_mode` và lượt thi qua downgrade; `test_reports::test_read_only_and_off_modes_with_legacy_gate` (chỉ-đọc rồi bật lại vẫn lưu được) |
| | Kiểm chứng backup | Một phần | `legacy_migration compare` khớp trên diễn tập local. Phải lặp lại với DB thật khi phát hành ([RUNBOOK_RELEASE.md](RUNBOOK_RELEASE.md) mục 1, 6) |

## Hạng mục Sprint 5

| Hạng mục | Trạng thái | Bằng chứng |
|---|---|---|
| Dashboard Admin (tài khoản theo role/trạng thái, lớp active, SV hoạt động 7/30 ngày theo progress_event, hoàn thành theo lab, điểm Lab Test TB) | Đạt | `test_reports::test_dashboard_counts_and_activity_definition`, `test_e2e` |
| Báo cáo lớp + CSV | Đạt | `test_reports::test_report_contents_csv_injection_and_scope`, `test_e2e` |
| Migration dữ liệu dry-run, lớp pilot từ danh sách, compiled_at chỉ là lịch sử | Đạt | `test_legacy_migration` (3 test), diễn tập bản sao |
| Redirect `/labN?lesson=` | Đạt (API) | `test_reports::test_lab_entry_one_many_none`; UI chỉ kiểm bằng lint/typecheck/build |
| LMS_CLASS_MODE theo lớp, chặn API cũ cho lớp đã bật | Đạt | `test_reports::test_read_only_and_off_modes_with_legacy_gate`, `test_course_configuration::test_no_membership_legacy_source_and_preview_boundaries` |
| Rollback chỉ-đọc + runbook | Đạt | `test_reports`, `test_e2e_postgres`, [RUNBOOK_RELEASE.md](RUNBOOK_RELEASE.md) |
| E2E liên vai trò | Đạt | `test_e2e::test_admin_teacher_student_report_flow` (SQLite), `test_e2e_postgres::test_cross_role_flow_and_class_mode_migration` (PostgreSQL + Alembic CLI) |
| Kiểm thử tải 300 SV | Một phần | Đúng dữ liệu, không lỗi; độ trễ burst cao — [LOAD_TEST.md](LOAD_TEST.md) |
| Hướng dẫn Admin/GV/SV | Đạt | [USER_GUIDE.md](USER_GUIDE.md) |

## Definition of Done còn mở

- GV duyệt học liệu và 180 câu Lab 0–8: **chưa** (ngân hàng đang rỗng).
- Pilot một lớp thật được nghiệm thu, flash/telemetry trên thiết bị thật: **chưa**.
- Đo tải trên server thật và chốt SLO/quy mô lớp: **chưa**.
- Giao diện mới (Tổng quan, Báo cáo lớp, chọn lớp từ link cũ, thông báo lớp chỉ-đọc) chưa được thử trên trình duyệt trong Sprint 5.

## Kết quả chạy

Chạy ngày 26/10/2026 trên máy phát triển (Windows, PostgreSQL 16.15 local):

| Lệnh | Kết quả |
|---|---|
| `npm run check` | Đạt — lint, typecheck, schema, 118 test Node, 161 test backend (16 skip: PostgreSQL/Docker opt-in) |
| `npm run build` | Đạt |
| `PSCUBESAT_TEST_POSTGRES=1 pytest app/tests` | **159 passed, 2 skipped** (2 skip là compiler Docker thật). Gồm `alembic upgrade head` trên DB sạch, `downgrade -1` → `upgrade head`, schema khớp ORM |
| `ruff check .` | Đạt |
| `python scripts/load_test.py --students 300` | Bất biến đạt, 0 lỗi; độ trễ xem LOAD_TEST.md |
