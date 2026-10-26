# Kiểm thử tải LMS

Ngày đo: 26/10/2026. Kết quả thô: [LOAD_TEST_2026-10-26.json](LOAD_TEST_2026-10-26.json).

## Mức tải

Sprint 1 chưa chốt số lớp/SV đồng thời (kế hoạch mục 12, “Nhân lực/tải”). Theo yêu cầu Sprint 5, dùng mức mặc định **300 SV đồng thời bắt đầu/nộp Lab Test** trong **một lớp** — trường hợp xấu nhất, vì mọi thao tác ghi của SV được tuần tự hóa theo dòng lớp (quyết định Sprint 3). Cần chốt lại con số thật trước khi mở rộng pilot.

## Cách đo

`python scripts/load_test.py --students 300` (trong `fastapi-backend/`):

- Tạo DB PostgreSQL riêng `pscubesat_load_<hex>`, chạy `alembic upgrade head` và seed giáo trình; xóa DB khi kết thúc. Không chạm DB ứng dụng.
- Chạy **một** worker uvicorn như production (`--workers 1`, vì MQTT consumer/WS room giữ trạng thái RAM). Client httpx gửi toàn bộ request của mỗi pha **cùng lúc**.
- Dữ liệu: 1 lớp, 300 SV, Lab 0 có tài liệu bắt buộc và Lab Test bắt buộc với ngân hàng 20 câu tổng hợp (nhập + duyệt + xuất bản qua API).
- Mỗi SV gửi **hai** lệnh bắt đầu và **hai** lệnh nộp với key khác nhau cùng lúc (mô phỏng double-click/hai tab).
- Máy đo: laptop Windows 11, 12 luồng CPU, Python 3.11, PostgreSQL 16.15 cùng máy; MQTT broker không chạy (BE chỉ cảnh báo kết nối lại).

## Kết quả (300 SV)

| Pha | Request | Thời gian (s) | req/s | p50 (ms) | p95 (ms) | p99 (ms) | Max (ms) | Mã trả về |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Sự kiện tiến độ (đọc tài liệu) | 300 | 7,1 | 42 | 4 379 | 6 521 | 6 737 | 6 788 | 300 × 200 |
| Đọc lộ trình | 300 | 6,1 | 49 | 3 571 | 5 589 | 5 751 | 5 846 | 300 × 200 |
| Bắt đầu Lab Test ×2 | 600 | 15,6 | 38 | 9 059 | 14 358 | 14 798 | 14 896 | 600 × 200 |
| Lưu đáp án | 300 | 8,9 | 34 | 5 210 | 8 113 | 8 369 | 8 453 | 300 × 200 |
| Nộp bài ×2 | 600 | 15,0 | 40 | 8 360 | 13 708 | 14 134 | 14 235 | 600 × 200 |
| Xem kết quả (refresh) | 300 | 7,1 | 42 | 4 178 | 6 505 | 6 687 | 6 732 | 300 × 200 |
| Báo cáo lớp (GV, 300 SV) | 20 | 3,7 | 5,4 | 3 348 | 3 689 | 3 689 | 3 689 | 20 × 200 |
| Dashboard Admin | 10 | 1,2 | 8,5 | 931 | 1 176 | 1 176 | 1 176 | 10 × 200 |

Bất biến kiểm trên DB sau khi chạy — **đạt**:

| Kiểm tra | Kỳ vọng | Thực tế |
|---|---:|---:|
| Lượt thi / SV có lượt | 300 / 300 | 300 / 300 |
| Câu trong đề (5 × 300) | 1 500 | 1 500 |
| Sự kiện chấm `labtest_graded` | 300 | 300 |
| Tiến độ Lab Test `completed` | 300 | 300 |
| Lượt đạt 5/5 | 300 | 300 |

Không có lỗi 5xx, không timeout. Double-click/hai tab không tạo thêm lượt và không cộng tiến độ hai lần.

## Đánh giá

- **Đúng dữ liệu dưới tải: đạt.** Không có lượt trùng, chấm trùng hay mất cập nhật.
- **Độ trễ khi dồn cùng một giây: cao.** Trần thông lượng ~35–50 req/s trên một worker, kể cả request chỉ đọc (không khóa lớp). Profile cho thấy khoảng 30–40 ms CPU/request phân tán qua middleware, ORM, dựng cấu hình lớp và serialize JSON — không có một điểm nóng đơn lẻ. 600 request đến cùng lúc thì request cuối chờ ~15 s.
- Chưa đặt SLO độ trễ vì Sprint 1 chưa chốt. Đề xuất: p95 ≤ 2 s cho lưu đáp án/nộp bài ở mức tải thực tế của một lớp. Mức tải dồn đồng thời 300 SV hiện **không** đạt đề xuất này.
- Đo trên laptop phát triển; server thật (Linux, cấu hình khác) cần đo lại bằng cùng script trước pilot.

## Rủi ro và đề xuất

1. **Lưu đáp án sát giờ.** Server xét hạn nộp theo thời điểm xử lý request. Nếu request lưu đáp án gửi trước hạn nhưng phải xếp hàng quá hạn thì đáp án đó bị từ chối (`ATTEMPT_EXPIRED`) và bài được chấm theo bản lưu trước. Màn hình thi tự lưu mỗi khi đổi lựa chọn nên chỉ các thay đổi trong vài giây cuối bị ảnh hưởng. Hướng xử lý cần quyết định nghiệp vụ: xét hạn theo thời điểm server nhận request, hoặc ân hạn vài giây. Chưa thay đổi trong Sprint 5.
2. **Tổ chức thi:** với lớp đông, cho các nhóm bắt đầu cách nhau 1–2 phút thay vì cùng một lúc; thời gian làm bài tính từ lúc server tạo lượt, nên chờ bắt đầu không làm mất thời gian thi.
3. **Mở rộng:** chạy nhiều worker cần tách MQTT consumer/WS room ra pub-sub trước (giới hạn đã ghi ở SERVER_MIGRATION_CUBESAT.md). Tối ưu trong một worker: cache dữ liệu course version đã xuất bản (bất biến) và giảm query dựng cấu hình mỗi request; khóa theo membership thay vì theo lớp cho các thao tác chỉ chạm dữ liệu của một SV. Cả hai cần thiết kế và test đồng thời riêng.
4. **Báo cáo lớp** ~185 ms/request với 300 SV. GV mở báo cáo đồng thời ít nên chấp nhận được; nếu lớp lớn hơn nhiều thì cân nhắc phân trang hoặc cache ngắn hạn.
