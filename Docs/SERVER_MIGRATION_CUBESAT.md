# Thay bản PTIT-STEM-CUBE bằng PSCubeSAT tại cubesat.p-tech.xyz

## Cấu hình đã chuẩn bị

Lệnh build/chạy ngắn gọn cho DB hiện có hoặc DB cài mới: [SERVER_STARTUP.md](SERVER_STARTUP.md).

Source cũ tại `C:/Users/Xuanuio/Desktop/IEC/CubeSAT/PTIT-STEM-CUBE` được đọc để đối chiếu. Bản mới đang ở `C:/Users/Xuanuio/Desktop/IEC/CubeSAT/PSCubeSAT`. Không ghi đè thư mục cũ và chưa đổi tuyến domain/server thật trong lượt cấu hình này.

Domain phân giải qua Cloudflare. Khi kiểm tra từ môi trường này ngày 21/10/2026, trang chính và API trả HTTP 403; chưa thể kết luận là ứng dụng, WAF hay Access đang chặn. Không có SSH hoặc cấu hình proxy thật trong task để xác nhận cách server vận hành.

Chọn **một** cách chạy:

| Hạ tầng hiện có | File Compose | Đích HTTPS proxy |
|---|---|---|
| Proxy hoặc cloudflared chạy trên host | `docker-compose.server.yml` | `http://127.0.0.1:5180` |
| Proxy/cloudflared chạy trong Docker | Thêm `docker-compose.proxy.yml`, đặt đúng `PROXY_NETWORK` đang tồn tại | `http://pscubesat-next-web:80` |
| Server chưa có HTTPS ingress | `docker-compose.production.yml` độc lập | Caddy chiếm 80/443 và cấp chứng chỉ |

Không chạy thêm Caddy nếu proxy hiện tại đã dùng 80/443. Không dùng compose mặc định để phát hành: bản đó có bind mount source và cổng API dành cho phát triển. Bộ server không có container_name cố định nên không đụng các container `frontend`/`backend` của bản cũ.

Luồng mới: Chrome/Edge → HTTPS domain → proxy hiện có → Nginx → `/api` và `/ws` cùng origin → FastAPI một worker → PostgreSQL/Redis/EMQX. USB cắm vào máy người dùng; server chỉ biên dịch trong Docker sandbox riêng.

## Những biến cần sửa

Trong checkout mới trên server, tạo `.env.server` từ `.env.server.example`. Tạo `fastapi-backend/.env` từ `.env.production.example` nếu chưa có; không chép đè file secret đang dùng. Không đưa hai file env thật vào Git.

| Biến | Cần đặt |
|---|---|
| `SITE_DOMAIN` | `cubesat.p-tech.xyz`, chỉ hostname |
| `FRONTEND_PORT` | `5180` hoặc cổng riêng chưa dùng; chỉ bind loopback |
| `RELEASE_TAG` | Tag mới duy nhất cho mỗi lần phát hành; giữ image tag trước để rollback |
| `BACKEND_ENV_FILE` | Mặc định `./fastapi-backend/.env` |
| `DATABASE_URL` | DB clone khi thử; DB thật khi chuyển chính thức. Dùng hostname truy cập được từ container, không dùng localhost của Windows/server host. URL-encode mật khẩu |
| `JWT_SECRET` | Giữ secret mạnh của server cũ để duy trì phiên, hoặc tạo secret mới ≥32 ký tự và yêu cầu đăng nhập lại. Placeholder/secret yếu bị từ chối ở production |
| `MQTT_HOST/PORT` | `mqtt.p-tech.xyz:8883`; tài khoản dịch vụ BE và mật khẩu thật |
| `MQTT_TLS/MQTT_TLS_VERIFY` | `true/true` với chứng chỉ công khai hợp lệ; CA_FILE trống để dùng hệ CA mặc định |
| `MQTT_TOPIC` | `sensors/#` |
| `COMPILER_IMAGE` | Ví dụ `pscubesat-compiler:2026-10-21`, phải build trên đúng Docker daemon BE truy cập |
| `GOOGLE_CLIENT_ID` | Giữ Web Client ID đang dùng nếu bật Google; Authorized JavaScript origins phải có `https://cubesat.p-tech.xyz` |
| `PROXY_NETWORK` | Chỉ dùng khi ingress là container; lấy đúng tên network thật, không đoán từ tên thư mục |

Compose tự đặt APP_ENV=production, Redis nội bộ và CORS đúng domain. FE mặc định `/api` và `/ws` cùng origin; không cần VITE_API_URL, không đưa credential MQTT/DB vào VITE_*. `VITE_WS_URL` để trống trừ khi cố tình dùng origin khác. FE env được đọc khi build; file .env host bị loại khỏi build context để tránh nhúng nhầm cấu hình phát triển.

EMQX: đăng ký user web ghi DB trực tiếp; credential thiết bị/ACL trong DB. Broker vẫn cần nguồn PostgreSQL đọc view `emqx_mqtt_authn/authz` bằng role có quyền SELECT. Migration không tự cấu hình broker và không cần gọi 18083. Giữ tài khoản dịch vụ BE; kiểm quyền subscribe `sensors/+/telemetry`. Xem [EMQX PostgreSQL](EMQX_POSTGRES_SETUP.md).

## PostgreSQL đang ở container khác

Lỗi `ConnectionRefusedError: [Errno 111] Connection refused` tại `init_db()` nghĩa là BE chưa mở được kết nối TCP tới PostgreSQL. Chưa thể kết luận sai mật khẩu hay lỗi TLS từ thông báo này. Compose bản mới không tự tạo PostgreSQL và không tự tham gia network của stack DB cũ.

Trên server, xác định container và network (không in env/credential):

```sh
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Networks}}'
# Thay TEN_CONTAINER_DB bằng tên thật lấy ở trên.
docker inspect TEN_CONTAINER_DB --format '{{json .NetworkSettings.Networks}}'
docker exec TEN_CONTAINER_DB pg_isready -h 127.0.0.1 -p 5432
```

Trong `.env.server`, đặt `DATABASE_NETWORK` bằng **network bridge hiện có của DB**. Trong BE `.env`, đặt `DATABASE_URL` dùng tên/alias container PostgreSQL trên network đó, cổng **nội bộ** (mặc định 5432). Ví dụ nếu host map `15432:5432`, container BE vẫn kết nối `ten-db:5432`, không dùng `localhost:15432` hay IP container dễ thay đổi. Giữ nguyên user/password/database của DB thật; URL-encode ký tự đặc biệt trong credential. Nếu PostgreSQL cấu hình cổng nội bộ khác thì dùng cổng thực tế đó.

Thêm overlay DB vào **mọi** lệnh Compose, gồm build, migration, up, logs và các lần cập nhật tiếp theo:

```sh
docker compose --env-file .env.server -p pscubesat-next -f docker-compose.server.yml -f docker-compose.database.yml config --quiet
docker compose --env-file .env.server -p pscubesat-next -f docker-compose.server.yml -f docker-compose.database.yml build fastapi
# Chỉ SELECT 1, không đổi schema, không cần Redis/compiler đang chạy.
docker compose --env-file .env.server -p pscubesat-next -f docker-compose.server.yml -f docker-compose.database.yml run --rm --no-deps migrate python server_preflight.py --database
```

Khi kiểm tra DB PASS và đã backup DB/chọn cửa sổ chuyển đổi, dùng cùng các tham số Compose để chạy `run --rm --no-deps migrate`, rồi `up -d --wait`. Nếu proxy cũng nằm trong Docker, thêm cả `-f docker-compose.proxy.yml` và cấu hình `PROXY_NETWORK` riêng. Overlay DB chỉ nối API/migrate tới DB, không nối frontend/Redis tới mạng DB, không mở thêm cổng PostgreSQL và không quản lý/xóa container hoặc volume DB cũ. Kiểm tra PostgreSQL lắng nghe trên interface Docker và `pg_hba.conf` cho phép subnet của network đã chọn nếu kết nối vẫn bị từ chối.

Kiểm thử bổ sung ngày 21/10/2026: cả DB external trên network riêng và DB managed cài mới đã PASS probe trước migration, migration lặp lại, API healthy, auth, MQTT, compiler/artifact và restart. External giữ user schema cũ; managed giữ user khi recreate container DB bằng volume cũ và hỗ trợ mật khẩu cần URL encoding. Bộ BE có 95 test (8 opt-in skipped), Docker build FE/BE và 8 tổ hợp cấu hình DB/ingress PASS. Đây là kiểm thử container cô lập trên máy phát triển; network/hostname PostgreSQL thật trên server vẫn cần xác nhận.

## Thứ tự chuyển đổi

1. Lưu lại Compose project/tên image/cấu hình proxy của bản cũ. Backup DB bằng công cụ của nhà cung cấp hoặc pg_dump; phục hồi thử vào một DB clone. Lưu secret hiện tại ngoài Git.
2. Đưa toàn bộ bản source mới sang thư mục riêng, ví dụ `/opt/pscubesat-next`. Phải có cả các file mới trong `app/firmware/curriculum`, catalog, router và FE; chỉ copy `dist` không đủ. Kiểm tra `git status`: file untracked chưa được commit/push thì server pull sẽ không có chúng.
3. Cấu hình bản thử dùng DB clone và broker test hoặc tài khoản/topic riêng phù hợp. Không để hai bản simulator cùng phát vào topic sản xuất. Duyệt migration trên clone, đặc biệt duplicate email/khóa ngoại/orphan rows. Migration 0001 chỉ nhận schema cũ đầy đủ; không tự stamp/bỏ qua khi báo lỗi.
4. Build trước, giữ domain vẫn trỏ bản cũ. Chạy các lệnh bên dưới với env của clone để nghiệm thu.
5. Chọn thời gian chuyển. Dừng BE/simulator cũ để không còn ghi DB, tạo backup cuối, đổi env bản mới sang DB thật và chạy migration. Sau khi mới healthy, chuyển ingress tới bản mới. Chỉ FE cũ còn phục vụ trong khoảng này sẽ không có API; nên thông báo bảo trì ngắn.
6. Kiểm đăng nhập, code đã lưu, biên dịch/nạp, telemetry và MQTT trước khi dừng hẳn bản cũ. Không xóa image/volume/backup cũ ngay.

Lệnh Linux chạy **trong thư mục bản mới**, với file env đã sửa và backup/clone đã chuẩn bị:

```sh
docker version
docker compose version
docker compose --env-file .env.server -p pscubesat-next -f docker-compose.server.yml config --quiet

# Tag phải khớp COMPILER_IMAGE trong BE env; không ghi đè tag compiler cũ.
docker build -f fastapi-backend/compiler/Dockerfile -t pscubesat-compiler:2026-10-21 fastapi-backend
docker compose --env-file .env.server -p pscubesat-next -f docker-compose.server.yml build frontend fastapi

# Kiểm cấu hình production trước; không in secret.
docker compose --env-file .env.server -p pscubesat-next -f docker-compose.server.yml run --rm --no-deps fastapi python server_preflight.py

# up chạy migrate trước API; chỉ thực hiện khi đã chọn đúng DB và backup.
docker compose --env-file .env.server -p pscubesat-next -f docker-compose.server.yml up -d --wait
docker compose --env-file .env.server -p pscubesat-next -f docker-compose.server.yml run --rm --no-deps fastapi python server_preflight.py --live
docker compose --env-file .env.server -p pscubesat-next -f docker-compose.server.yml ps -a
curl -I http://127.0.0.1:5180/login
```

Mỗi lần phát hành có migration mới, chạy lại `run --rm migrate` trong cửa sổ bảo trì trước `up`; không chỉ `docker compose restart` vì restart không build mã mới hoặc chạy lại migration. Dùng `logs --tail=100 fastapi migrate frontend` để xem lỗi. Không chia sẻ output `docker compose config` đầy đủ vì nó có thể chứa env secret; dùng `config --quiet`.

Với ingress Docker, thêm `-f docker-compose.proxy.yml` vào tất cả lệnh Compose sau khi đặt PROXY_NETWORK; đổi tuyến tunnel tới `pscubesat-next-web:80`. `127.0.0.1` bên trong container tunnel là chính container đó, không phải host. Chỉ frontend tham gia ingress network, BE/Redis ở mạng nội bộ.

Nếu proxy host là Nginx, áp dụng vào vhost HTTPS **hiện có**, giữ chứng chỉ và các quy tắc domain của server:

```nginx
location / {
    proxy_pass http://127.0.0.1:5180;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 720s;
    proxy_send_timeout 720s;
    client_max_body_size 20m;
}
```

Nếu vhost có location `/api` hoặc `/ws` cũ, sửa/bỏ chúng để cùng chuyển tới frontend mới; chúng có thể ưu tiên hơn `location /`. Access log ở proxy ngoài cũng cần bỏ query string cho `/ws/devices/*` vì URL chứa JWT. Không cache HTML/API/artifact, chỉ cache immutable `/assets/*`. Purge HTML cũ trong Cloudflare sau khi cutover, không xóa localStorage của người dùng.

## Nghiệm thu và giới hạn vận hành

- Chưa đăng nhập bị đưa về login; API dịch vụ trả 401. Sau login, `/api/health` có Bearer token phải trả compiler_installed=true và mqtt.connected=true. Docker healthcheck nội bộ dùng `/`, không coi 401 của `/api/health` là container chết.
- Mở trực tiếp domain HTTPS bằng Chrome/Edge desktop. `window.isSecureContext` và `'serial' in navigator` phải true; Permissions-Policy phải cho `serial=(self)`. Board cắm ở client; không cần mount USB của server.
- Build đúng ESP32/ESP32-S3, tải đủ bốn image có hash, flash thật và xem Serial 115200. Artifact của bản cũ có thể không tồn tại trong volume mới: biên dịch lại. Workspace đã lưu giữ được khi cùng scheme/domain/port và key tương thích; nên export `.ino`/Blockly trước nâng cấp.
- Nguồn hardware phải dùng đúng device UID, owner và telemetry schema. `wss://cubesat.p-tech.xyz/ws/devices/<uid>` cần token; không còn WS `/ws` chung. Chỉ số demo/simulator không chứng minh board đã gửi.
- Một API worker/container: MQTT consumer, simulator và WS room đang có trạng thái RAM. Chạy nhiều worker/replica chưa có fan-out Redis sẽ làm lệch telemetry; muốn scale cần tách worker/pub-sub trước.
- Có tối đa hai job compiler chạy đồng thời (mỗi board khóa riêng), tối đa bốn request trong admission queue. Mỗi sandbox tối đa 1,5 GiB và 2 CPU. Gợi ý ban đầu 4 vCPU, 8 GiB RAM, SSD ≥20 GiB trống; phải đo tải thật. Docker socket cho BE là quyền quản trị Docker; sandbox user code không có socket/network/secret.
- Nginx chờ compiler 720s, nhưng Cloudflare có giới hạn chờ riêng (tài liệu hiện tại nêu mặc định 125s). Build lâu có thể vẫn lỗi 524. Cần warm compiler và đo qua domain thật; nếu vượt giới hạn, bước tiếp theo là compile job bất đồng bộ/polling, không chỉ tăng timeout Nginx. [Cloudflare 524](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/)
- Lab1.6 mở IP ESP trong LAN của người học. Việc trang HTTPS mở trang HTTP của ESP trong tab mới không phải server cloud truy cập ESP; máy người học phải cùng mạng với ESP.
- Monaco editor và Google Fonts còn dùng nguồn bên ngoài; nếu mạng trường chặn CDN cần cấu hình self-host riêng. Google login cần Client ID/origin thật. Không khẳng định các luồng này đã qua domain thật khi hiện còn 403.
- Audit npm sau cập nhật patch còn 2 moderate liên quan React Router. Không dùng `--force` để nhảy major trong bản chuyển server này; SSR không dùng ở dự án, redirect đăng nhập đã giới hạn route nội bộ. Nâng React Router major cần lượt migration/test riêng; không coi là đã xóa toàn bộ cảnh báo dependency.

## Rollback

Giữ tuyến ingress cũ, image tag cũ và backup DB đã kiểm. Nếu chỉ frontend/proxy lỗi và schema vẫn tương thích, trả ingress về bản cũ. Nếu schema đã đổi và cần khôi phục DB, dừng cả hai BE, restore backup vào DB riêng, trỏ bản cũ tới DB phục hồi rồi mới mở lại. Các migration có bước forward-only; không chạy downgrade mù. Giao dịch phát sinh sau backup cần kế hoạch giữ/đối soát trước restore. Không dùng `down -v` trên project thật.

## Kiểm tra có thể chạy lại

Các npm script Python dùng `scripts/python.mjs`, không còn đường dẫn cố định của máy phát triển. Runner ưu tiên `PSCUBESAT_PYTHON`, virtualenv dự án hoặc môi trường Conda; trên Linux có thể tạo `.venv` và cài `fastapi-backend/requirements-dev.txt` trước khi chạy `npm run check`. Migration trong Compose kiểm `server_preflight.py` trước khi thay schema, từ chối env còn placeholder hoặc origin không hợp lệ.

Kết quả 21/10/2026: `npm run check` PASS (68 telemetry tests, BE 89 tests với 8 integration opt-in skipped); Docker build FE/BE PASS; kiểm cấu hình ba cách Compose PASS; TLS/WSS/proxy/Serial policy/cache/asset 404 PASS. Test server stack dùng PostgreSQL 17 + Redis + Mosquitto riêng đã PASS adoption schema cũ có user mẫu, preflight live, auth, MQTT→API, compiler sandbox thật, bốn hash artifact và restart API. Browser chạy trên image frontend production đã PASS đủ 32 bài, các tương tác và vòng đời đăng nhập/USB. Npm audit sau patch còn 2 moderate; không còn high/critical trong kết quả npm audit hiện tại. Chunk biểu đồ giảm khoảng 44% (1,14 MB xuống khoảng 631 KB trước gzip). Đây là kiểm thử cục bộ với dữ liệu test, không phải nghiệm thu DB/broker/domain production hoặc flash phần cứng mới.

`npm run check`, `npm run build`, `python scripts/test-https-deployment.py` và `python scripts/test-server-stack.py` (cần Docker, image FE/BE tag server-review và compiler:1). Test cuối dùng PostgreSQL/MQTT/network/volume ngẫu nhiên, seed schema cũ và user mẫu, migrate, đăng ký/đăng nhập, nhận MQTT qua API và compile thật, kiểm SHA256 artifact rồi dọn tài nguyên test. Không dùng DB/broker/domain thật.

Tham khảo: [Docker Compose startup dependencies](https://docs.docker.com/compose/how-tos/startup-order/), [Vite production build](https://vite.dev/guide/build), [ECharts modular imports](https://echarts.apache.org/handbook/en/basics/import/).
