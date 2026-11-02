# Runbook phát hành LMS pilot

Ngày lập: 26/10/2026. Áp dụng cho bản có migration `0010_class_lms_mode` (Sprint 5). Lệnh Compose, ingress và secret theo [SERVER_MIGRATION_CUBESAT.md](SERVER_MIGRATION_CUBESAT.md); runbook này chỉ thêm các bước riêng của LMS. Ký hiệu dùng bên dưới:

```sh
DC="docker compose --env-file .env.server -p pscubesat-next -f docker-compose.server.yml"
# URL kết nối không in ra màn hình/log; đặt trong shell của người vận hành.
export SOURCE_URL='postgresql://...@host:5432/cubesat'          # DB thật
export CLONE_URL='postgresql://...@host:5432/cubesat_rehearsal'  # bản sao để diễn tập
```

Công cụ dữ liệu: `python -m app.services.legacy_migration` (`report`, `import-pilot`, `compare`). `report` và `import-pilot` khi không có `--apply` chạy trong transaction chỉ-đọc.

## 0. Điều kiện trước khi bắt đầu

- Bản build đã qua `npm run check`, `npm run build`, pytest với `PSCUBESAT_TEST_POSTGRES=1` (xem [ACCEPTANCE_CHECKLIST.md](ACCEPTANCE_CHECKLIST.md)).
- GV đã nghiệm thu học liệu, rubric và ngân hàng của các lab sẽ bật cho lớp pilot. Lab chưa đủ 20 câu đã duyệt không đặt Lab Test bắt buộc.
- Có danh sách lớp pilot dạng JSON (mẫu ở mục 3). Không có danh sách thì không nhập lớp: hệ thống không tự gán user vào lớp.
- Thông báo cửa sổ bảo trì. Giữ image tag, ingress và backup của bản đang chạy.

## 1. Backup và xác minh backup

```sh
# Dừng ghi: dừng BE/simulator cũ để không còn transaction mới trong lúc dump.
pg_dump "$SOURCE_URL" -F c -f cubesat-$(date +%Y%m%d-%H%M).dump
createdb -T template0 cubesat_rehearsal   # hoặc tạo DB qua nhà cung cấp
pg_restore --no-owner -d "$CLONE_URL" cubesat-YYYYMMDD-HHMM.dump
$DC run --rm --no-deps -e DATABASE_URL="$CLONE_URL" fastapi \
  python -m app.services.legacy_migration compare --source "$SOURCE_URL" --restored "$CLONE_URL"
```

`compare` trả mã 0 và `"matches": true` khi số dòng của `users`, `lab_progress`, lớp, tiến độ, bài nộp, lượt thi, audit… trùng nhau. Mã 1 là backup **chưa** dùng được: dừng phát hành. Lưu file dump ở nơi ngoài server, kèm checksum (`sha256sum`).

## 2. Diễn tập migration trên bản sao

```sh
$DC run --rm --no-deps -e DATABASE_URL="$CLONE_URL" migrate                 # alembic upgrade head
$DC run --rm --no-deps -e DATABASE_URL="$CLONE_URL" fastapi python -m app.services.curriculum_seed
$DC run --rm --no-deps -e DATABASE_URL="$CLONE_URL" fastapi \
  python -m app.services.legacy_migration report --pilot pilot.json --out mapping-report.json
$DC run --rm --no-deps -e DATABASE_URL="$CLONE_URL" fastapi python -m alembic downgrade -1
$DC run --rm --no-deps -e DATABASE_URL="$CLONE_URL" migrate
```

Đọc `mapping-report.json` trước khi tiếp tục:

| Mục | Điều kiện đạt |
|---|---|
| `database.alembic_revision` | `0010_class_lms_mode` |
| `lesson_ids.missing` | Rỗng; `mapped` = `legacy_total` (84) |
| `users.total`, `lab_progress.rows` | Bằng số trên DB nguồn (migration chỉ thêm, không xóa) |
| `lab_progress.unknown_lab_ids` | Rỗng |
| `pilot.errors` | Rỗng. Từng SV có `action` = `add`/`keep`/`restore`; `problem` (`NOT_REGISTERED`, `ACCOUNT_LOCKED`, `IS_CLASS_TEACHER`) phải được xử lý trước |
| `pilot.students[].legacy_compiled_labs` | Chỉ để GV tham khảo; không được chuyển thành hoàn thành |

Downgrade `-1` chỉ lùi revision, giữ cột `lms_mode` và mọi dữ liệu; upgrade lại phải thành công. Diễn tập ngày 26/10/2026 trên bản sao DB local: [MIGRATION_REHEARSAL_2026-10-26.json](MIGRATION_REHEARSAL_2026-10-26.json) (0005 → 0010, backup khớp, 84/84 ID, downgrade/upgrade giữ dữ liệu).

## 3. Migrate DB thật và nhập lớp pilot

Chỉ làm sau khi mục 1–2 đạt trên bản sao **cùng thời điểm** với DB thật.

```sh
# Backup cuối ngay trước migrate (lặp lại mục 1, lưu tên file vào biên bản).
$DC run --rm --no-deps migrate
$DC run --rm --no-deps fastapi python -m app.services.curriculum_seed
$DC run --rm --no-deps fastapi python -m app.services.legacy_migration import-pilot --pilot pilot.json        # dry-run
$DC run --rm --no-deps fastapi python -m app.services.legacy_migration import-pilot --pilot pilot.json --apply
$DC up -d --wait
```

Mẫu `pilot.json` (email phải đã đăng ký; GV đã được Admin cấp role teacher):

```json
{
  "actor_email": "admin@truong.edu.vn",
  "teacher_email": "gv@truong.edu.vn",
  "class": {"code": "CUBESAT-PILOT-1", "name": "CubeSAT pilot 1", "term": "HK1 2026-2027", "status": "active"},
  "student_emails": ["sv1@truong.edu.vn", "sv2@truong.edu.vn"]
}
```

`import-pilot --apply` dùng cùng nghiệp vụ với màn hình GV (audit, khôi phục membership cũ). Nếu dừng giữa chừng có thể chạy lại: thành viên đã có trả `keep`. Lỗi danh sách (`errors` khác rỗng) thì không ghi gì.

Bật cờ: `LMS_CLASS_MODE=true` trong env server. Lớp mới mặc định `lms_mode=enabled`; lớp có từ trước 0010 được giữ `enabled`. Admin đổi chế độ từng lớp tại **Tổng quan → Chế độ pilot theo lớp** hoặc `PATCH /api/admin/classes/{id}/lms-mode` (bắt buộc lý do, có audit).

## 4. Kiểm tra sau migrate

1. `$DC run --rm --no-deps fastapi python server_preflight.py --live`; `$DC ps -a` không có container lỗi; `logs --tail=100 fastapi migrate` không có lỗi.
2. `compare --source <dump đã khôi phục trước migrate> --restored "$SOURCE_URL"`: `users`, `lab_progress` không đổi.
3. Admin đăng nhập: **Tổng quan** hiện đúng số tài khoản; lớp pilot ở trạng thái “Đang bật”.
4. GV: lớp pilot hiện đúng danh sách SV; **Cấu hình** xuất bản được; **Báo cáo lớp** mở và xuất CSV.
5. SV pilot: `/lab1?lesson=...` cũ chuyển vào lớp (nhiều lớp thì hiện màn hình chọn); `/api/progress` cũ trả 403. User ngoài pilot vẫn mở `/lab0`–`/lab8` như cũ.
6. Hồi quy theo [SERVER_MIGRATION_CUBESAT.md](SERVER_MIGRATION_CUBESAT.md) mục nghiệm thu: đăng nhập, C++/Blockly, biên dịch, tải artifact, flash thật, telemetry/MQTT.
7. Một SV thử: đọc tài liệu Lab 0 → làm Lab Test → kết quả và mở Lab 1/2; GV thấy kết quả trong báo cáo.

Ghi kết quả từng bước vào biên bản phát hành (người thực hiện, thời gian, file backup, checksum).

## 5. Rollback

Chọn mức nhẹ nhất xử lý được sự cố. Không chạy `alembic downgrade` để “gỡ” dữ liệu và không xóa bảng/volume.

| Mức | Khi nào | Thao tác | Kết quả |
|---|---|---|---|
| A. Lớp chỉ-đọc | Lỗi nghiệp vụ trong một lớp (chấm sai, mở khóa sai, ngân hàng sai) | Admin đặt lớp `read_only` kèm lý do | Mọi ghi của lớp (học, nộp, thi, cấu hình, chấm) trả `CLASS_READ_ONLY`; SV vẫn xem kết quả, dùng nội dung trải nghiệm; **không** mở lại đường legacy cho SV lớp đó. Bật lại `enabled` là tiếp tục với dữ liệu nguyên vẹn |
| B. Tắt lớp | Lớp phải quay về cách học cũ một thời gian | Admin đặt `off` | SV lớp đó dùng `/labN` cũ như user ngoài pilot; dữ liệu lớp giữ nguyên, GV vẫn xem báo cáo |
| C. Tắt LMS toàn hệ thống | Lỗi chung của module LMS | Đặt `LMS_CLASS_MODE=false`, `$DC up -d --wait` | Mọi user về luồng ổn định cũ; bảng LMS giữ nguyên để bật lại |
| D. Quay về image cũ | Lỗi ứng dụng ngoài LMS mà C không xử lý được | Theo mục Rollback của SERVER_MIGRATION_CUBESAT.md | Chỉ dùng image đã hiểu role `teacher` và các bảng lớp (từ Sprint 1 trở đi). Image trước LMS không được chạy trên DB đã có role `teacher` (xem DECISIONS.md, Sprint 1); khi đó dùng mức C hoặc E |
| E. Khôi phục DB | Dữ liệu hỏng | Dừng mọi BE, restore backup vào DB **riêng**, đối soát giao dịch phát sinh sau backup, rồi mới trỏ ứng dụng sang | Chỉ dùng khi A–D không đủ; có mất dữ liệu sau thời điểm backup |

Lượt thi đang làm khi chuyển `read_only`: SV không lưu/nộp thêm được; khi hết giờ, worker vẫn chấm theo đáp án đã lưu trước đó (không thay đổi đáp án). Ghi lại các lượt bị ảnh hưởng để GV cấp thêm lượt có lý do sau khi bật lại.

## 6. Kiểm chứng định kỳ backup

Mỗi tuần trong thời gian pilot: khôi phục bản dump mới nhất vào DB riêng và chạy `compare` với DB thật ở cùng thời điểm (hoặc với số liệu ghi lúc dump). Ghi kết quả; hai lần liên tiếp không khớp thì dừng mở rộng pilot cho đến khi xử lý xong.
