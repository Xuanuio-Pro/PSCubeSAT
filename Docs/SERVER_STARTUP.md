# Build và chạy BE + PostgreSQL trên server

Chạy các lệnh ở thư mục gốc PSCubeSAT. Server cần Docker Engine + Compose v2, Bash và đủ dung lượng build compiler. Mặc định bản này dùng proxy/cloudflared hiện có. Tùy chọn `--tunnel` dành riêng cho thay connector do chính Compose project cũ quản lý.

## 1. Cấu hình một lần

Nếu chưa có file env, tạo từ mẫu; giữ nguyên file thật đang dùng:

```bash
cp -n .env.server.example .env.server
cp -n fastapi-backend/.env.production.example fastapi-backend/.env
```

BE env cần JWT_SECRET mạnh, credential MQTT thật và COMPILER_IMAGE đúng tag sẽ build. Không đưa env thật lên Git. Với `cubesat.p-tech.xyz`, giữ SITE_DOMAIN trong `.env.server`; FE và API dùng cùng origin. Các giá trị placeholder trong env bị từ chối trước migration.

Chọn một chế độ DB:

| Chế độ | Khi dùng | Cần cấu hình |
|---|---|---|
| `external` | Tiếp tục dùng container PostgreSQL hiện có và dữ liệu cũ | `.env.server`: DATABASE_NETWORK là network bridge hiện có của DB. BE `.env`: DATABASE_URL trỏ hostname/alias DB trên network đó và cổng nội bộ (thường 5432) |
| `managed` | Cài mới với DB riêng, volume riêng của project | `.env.server`: POSTGRES_USER, POSTGRES_DB, POSTGRES_PASSWORD. Compose tự nối BE/migrate tới postgres:5432; không dùng DATABASE_URL cũ trong BE env |
| `remote` | DB ở máy khác, truy cập được từ container | BE `.env`: DATABASE_URL thật, có SSL theo yêu cầu của DB |

Chế độ `managed` tạo DB mới, không tự chép dữ liệu DB cũ. Để tiếp tục user/thiết bị đang có trên server, dùng `external`. Lấy tên/network DB bằng `docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Networks}}'`. Không dùng localhost hay cổng publish của host trong DATABASE_URL khi nối trực tiếp container qua Docker network.

Nếu proxy/cloudflared chạy trong Docker, đặt PROXY_NETWORK đúng network ingress hiện có rồi thêm `--proxy` **sau chế độ DB** trong mọi lệnh wrapper bên dưới. Ví dụ `bash deploy/server.sh external --proxy ps`. Tuyến domain trỏ `http://pscubesat-next-web:80`. Nếu ingress chạy trên host, không thêm `--proxy`, tuyến tới `http://127.0.0.1:5180`.

Wrapper đọc SERVER_PROJECT trong `.env.server`, mặc định `pscubesat-next`, để giữ volume qua các lần cập nhật. Biến SERVER_PROJECT đã export trong shell được ưu tiên. Nếu thay stack đang có, đặt đúng tên project cũ. Xem [hướng dẫn chuyển đổi](SERVER_MIGRATION_CUBESAT.md) để backup, chuyển domain và rollback.

### Trường hợp đã xác nhận: server chưa có DB CubeSAT

Danh sách container đang chạy/bị dừng không có PostgreSQL CubeSAT và host không lắng nghe cổng 5432: dùng DB managed riêng. Với stack hiện có network `pscubesat_cubesat_net`, project là `pscubesat`, frontend cổng 5173 và token tunnel trong `.env` root, chạy trong checkout server:

```bash
git pull --ff-only origin main
bash deploy/initialize-cubesat.sh
```

Runner kiểm project của connector cũ, build image setup, cấu hình env, build FE/BE/compiler, chờ PostgreSQL healthy, probe bằng SELECT 1, migrate rồi up toàn bộ và preflight live. Nó dừng ở bước đầu tiên gặp lỗi. Có thể truyền tag release riêng làm tham số đầu tiên. Xem `deploy/initialize-cubesat.sh` để kiểm tra từng lệnh; không chạy `down -v`/`rm` hay xóa dữ liệu DB. Bước `up` có thể thay container ứng dụng/tunnel trong cùng project; không đổi dự án khác.

Bước setup sửa `.env.server` và BE env tại chỗ, chỉ thực hiện khi đầu vào đã hợp lệ. Nó giữ credential MQTT; giữ JWT mạnh hiện có (chỉ tạo JWT khi thiếu/yếu); giữ POSTGRES_PASSWORD nếu đã cấu hình, nếu chưa có thì dùng password từ DB URL cũ hoặc tạo mới. Nó đổi DB URL sang `postgres:5432`, đặt project `pscubesat`, frontend 5173, BE 8000 và compiler tag `server-db`. Chạy lại không tự đổi password DB/JWT đã hợp lệ. Không in secret và không cần cài Python/pip trên host. Có thể commit source rồi pull nhưng hai file env thật phải ở server, không đưa vào Git.

### Nếu báo network has active endpoints

Compose cũ khai báo network `cubesat_net` với `driver: bridge`. Khi đổi định nghĩa network trong cùng project, Compose có thể cố tái tạo `pscubesat_cubesat_net` rồi bị chặn vì frontend/Redis/tunnel cũ còn dùng nó. Initializer hiện đặt `SERVER_NETWORK_NAME=pscubesat_cubesat_net` và `SERVER_NETWORK_EXTERNAL=true`, dùng lại network nguyên trạng; chỉ tạo bridge nếu network chưa tồn tại. Các lệnh wrapper về sau đọc hai giá trị này từ `.env.server`.

Pull bản sửa và chạy lại `bash deploy/initialize-cubesat.sh`; không cần xóa network, force-disconnect endpoint hoặc xóa volume. Password DB/JWT đã tạo được giữ lại. Dùng wrapper cho các lệnh triển khai, không gọi `down` bằng Compose cũ vì file cũ vẫn coi network là tài nguyên cần xóa. Network external tiếp tục tồn tại sau khi stack dừng.

Setup chỉ sửa env; các lệnh tiếp theo tạo DB mới và migration. Chúng không phục hồi dữ liệu từ backup hay volume DB thất lạc. Nếu có backup CubeSAT cần phục hồi thì phục hồi vào DB trước khi mở dịch vụ. Không dùng `ptr_staging-db-1` hoặc DB của ứng dụng khác. Các lệnh wrapper này thay cho chạy lại Compose cũ, không merge vào file cũ. Cloudflared được thay trong cùng project, origin alias `nginx` vẫn giữ nguyên.

### Server đang chạy Compose cũ có cloudflared-cubesat

File cũ dùng các container `frontend`, `backend`, `redis`, bind mount source BE và thiếu migration/network PostgreSQL. Chỉ pull/build image rồi chạy lại file đó sẽ chưa áp dụng cách nối DB mới. Các lệnh wrapper bên dưới dùng các file server mới riêng, không merge vào Compose cũ đã tùy chỉnh trên server.

Nếu muốn thay connector trong cùng stack, lấy tên project thật từ label trước:

```bash
docker inspect cloudflared-cubesat --format '{{index .Config.Labels "com.docker.compose.project"}}'
```

Đặt `SERVER_PROJECT` bằng kết quả này (`export SERVER_PROJECT=...`), giữ file `.env` root có TUNNEL_TOKEN và đặt `TUNNEL_ENV_FILE=./.env` trong `.env.server`. Sau đó dùng `external --tunnel` thay `external` trong các bước build/probe/migrate/up. Cùng project sẽ thay service `cloudflared` hiện có; tên container mới do Compose quản lý để tránh đụng tên cố định. Nếu label trống hoặc connector thuộc stack khác, dùng `--proxy` nối ingress có sẵn thay vì tạo connector thứ hai.

Alias `nginx` được giữ trên frontend; origin cũ `http://nginx:80` tiếp tục dùng được trong mạng stack. Nếu tunnel đang trỏ tên `frontend`, DNS service đó vẫn có. Nếu origin dùng cổng host, đặt FRONTEND_PORT theo cổng thật (ví dụ 5173); proxy ở container khác cần dùng Docker network thay vì localhost.

DB URL có host `127.0.0.1:5432` không dùng được cho DB ở container khác. Chỉ thay host bằng tên/alias PostgreSQL trên DATABASE_NETWORK, giữ credential và database name. Uvicorn trong image chạy ở cổng 8000; `PORT=8005` của môi trường phát triển không đổi cổng này. Nginx mới gọi service `fastapi:8000`.

## 2. Build

Ví dụ dưới đây dùng DB hiện có; thay `external` bằng `managed` hoặc `remote` theo cấu hình đã chọn. Thêm `--proxy` nếu cần.

```bash
bash deploy/server.sh external config --quiet
bash deploy/server.sh external build frontend fastapi
# Tag phải khớp COMPILER_IMAGE trong BE .env.
docker build -f fastapi-backend/compiler/Dockerfile -t pscubesat-compiler:2026-10-21 fastapi-backend
```

Với `managed`, khởi động DB trước probe: `bash deploy/server.sh managed up -d --wait postgres`. DB không publish cổng ra host. Mật khẩu được tạo chuỗi kết nối bằng URL encoder, hỗ trợ ký tự đặc biệt; khi ghi env có `$` hoặc `#`, dùng cú pháp single quote của file dotenv. Giữ mật khẩu đã khởi tạo với volume PostgreSQL; đổi biến env không tự đổi mật khẩu role trong volume cũ.

## 3. Kiểm tra và chạy

```bash
# Chỉ kiểm tra kết nối DB bằng SELECT 1, không sửa schema.
bash deploy/server.sh external run --rm --no-deps migrate python server_preflight.py --database

# Sau khi backup DB thật và chọn cửa sổ cập nhật:
bash deploy/server.sh external run --rm --no-deps migrate
bash deploy/server.sh external up -d --wait --wait-timeout 180
bash deploy/server.sh external ps -a
bash deploy/server.sh external run --rm --no-deps fastapi python server_preflight.py --live
```

Thứ tự khởi động: PostgreSQL healthy (managed) → migration thành công → BE healthy → FE. Redis phải healthy trước BE. Migrate lỗi thì BE không chạy với schema sai. Mỗi release chạy lại bước migrate; chỉ restart không áp dụng image/migration mới. Không chạy `down -v` trên project chứa dữ liệu thật.

Xem lỗi bằng `bash deploy/server.sh external logs --tail=100 migrate fastapi` (thêm `postgres` khi managed). Lỗi mới chỉ rõ DB host/port và nhóm lỗi DNS, TCP, xác thực hoặc TLS; không in password. `--live` kiểm thêm migration head, Redis và compiler image. Nghiệm thu qua domain HTTPS cần đăng nhập, biên dịch, nạp USB tại máy client và kiểm MQTT thật.

## Kiểm thử trên máy phát triển

```bash
npm run test:be
python scripts/test-server-stack.py --database external
python scripts/test-server-stack.py --database managed
```

Hai test Docker dùng project/network/volume test ngẫu nhiên, broker riêng và image `server-review` đã build. External kiểm giữ user từ schema cũ; managed kiểm DB mới với mật khẩu cần URL encoding, migration lặp lại, đăng ký/đăng nhập, MQTT, biên dịch thật, hash artifact và restart. Chúng không kết nối DB/broker production.

Kết quả ngày 21/10/2026: build FE/BE PASS; 95 BE test (8 opt-in skipped); external và managed đều PASS, bao gồm recreate PostgreSQL giữ nguyên user; 8 tổ hợp Compose DB/ingress PASS. Chưa áp dụng thay đổi trực tiếp lên server thật từ môi trường kiểm thử này.

Kiểm bổ sung cho Compose cũ: HTTP qua alias `nginx` và luồng external DB đầy đủ PASS; cấu hình `--tunnel` với external/managed DB PASS. Không khởi động connector Cloudflare hoặc thay tuyến domain production trong kiểm thử.

Lượt setup managed: 99 BE test (8 opt-in skipped) PASS; image setup tạo env thật trong thư mục test rồi chạy PostgreSQL, probe, migration/idempotency, auth, MQTT, compiler, hash artifact, recreate DB giữ user và restart API PASS. Test cũng xác nhận Compose lấy đúng project từ `.env.server` khi không có `-p`, setup lặp lại giữ credential/JWT và thiếu MQTT/token thì dừng trước khi sửa file.

Lượt sửa active endpoints: đã tái hiện lỗi chuyển từ network `driver: bridge` sang định nghĩa mới khi còn ba endpoint. Sau sửa, test dùng network do Compose cũ tạo, giữ nguyên ID network và cả ba container cũ đang chạy trong suốt luồng DB/API/compiler; kết quả PASS. Bộ BE có 100 test (8 opt-in skipped); cấu hình fresh/external theo project và cú pháp shell PASS. Các biến Compose export từ shell được loại khỏi môi trường test và mọi lệnh thay đổi trong test đều cố định project test ngẫu nhiên.
