# Checklist triển khai: Tái cấu trúc Ground Station cho ESP32-S3

Tài liệu này là checklist tương tác để bạn theo dõi tiến độ thực hiện Giải pháp 1 (Web Serial API + React + TS + Vite).

---

## 🛠️ Giai đoạn 1: Khởi tạo dự án & Cài đặt cấu hình
- [x] **1.1. Khởi tạo dự án Vite mới**
  * Chạy lệnh: `npm create vite@latest PTIT-STEM-CUBE -- --template react-ts`
- [x] **1.2. Cài đặt các thư viện thiết yếu**
  * `npm install zustand satellite.js @types/satellite.js uplot` (cái này tôi k cài được, lỗi 404 not found)
  * `npm install three @types/three @react-three/fiber @react-three/drei`
  * `npm install esptool-js` (Thư viện JS chính thức của Espressif để flash chip qua Web Serial)
- [x] **1.3. Cài đặt và cấu hình Tailwind CSS**
  * Cài đặt: `npm install -D tailwindcss postcss autoprefixer`
  * Khởi tạo file cấu hình và thiết lập đường dẫn template trong `tailwind.config.js`.
- [x] **1.4. Thiết lập thư mục và tài nguyên mẫu**
  * Di chuyển tệp [natural-earth-land-110m.js](natural-earth-land-110m.js) vào thư mục `src/services/` hoặc `public/` để vẽ bản đồ.

---

## 🔌 Giai đoạn 2: Phát triển lõi giao tiếp Serial & Bộ giải mã (Parser)
- [ ] **2.1. Hiện thực hóa Custom Hook `useWebSerial.ts`**
  * Gọi API `navigator.serial.requestPort()`.
  * Quản lý trạng thái đóng/mở cổng và luồng đọc dữ liệu (`ReadableStream`).
- [ ] **2.2. Viết bộ giải mã Telemetry (`telemetryParser.ts`)**
  * Đọc mảng byte (`Uint8Array`) để tìm cấu trúc nhị phân bắt đầu bằng `0x7E`.
  * Tách thông tin: ID vệ tinh, Loại gói tin (`0x10` - HK, `0x11` - Mission), payload dữ liệu cảm biến và kiểm tra tính hợp lệ của Checksum.
  * Phân tích cú pháp dạng text fallback (ví dụ: chuỗi `AX = 1.0`, `TEMP = 25.0`).
- [ ] **2.3. Tích hợp chuỗi truy vấn RSSI (XBee Command mode)**
  * Hàm JS gửi chuỗi `+++`, chờ 1 giây, gửi `ATDB\r` để đọc độ mạnh tín hiệu, sau đó gửi `ATCN\r` để thoát chế độ lệnh.

---

## 💾 Giai đoạn 3: Quản lý Trạng thái & Cơ học quỹ đạo (Orbit Math)
- [ ] **3.1. Thiết lập Zustand Store (`telemetryStore.ts`)**
  * Khai báo state lưu trữ: dữ liệu cảm biến mới nhất, mảng dữ liệu lịch sử (tối đa 200 điểm), log bảng điều khiển, trạng thái kết nối cổng COM.
- [ ] **3.2. Viết thư viện tính toán TLE (`orbitalMath.ts`)**
  * Dùng `satellite.js` để parse bộ TLE vệ tinh.
  * Viết hàm cập nhật định kỳ mỗi giây để tính toán tọa độ vệ tinh (Lat/Lon) và các góc ngẩng (Elevation), góc phương vị (Azimuth) đối với trạm.

---

## 💻 Giai đoạn 4: Xây dựng các Component Giao diện (React Components)
- [ ] **4.1. `StatusFooter` & `Header`**
  * Hiển thị cổng COM đang kết nối, trạng thái pin vệ tinh, cường độ sóng RSSI và tốc độ truyền nhận dữ liệu.
- [ ] **4.2. `SerialConsole` (Điều khiển & Macros)**
  * Tích hợp khung nhập lệnh ASCII & HEX.
  * Thiết kế các nút lệnh tắt nhanh (Macros) để bật/tắt cảm biến bằng 1 click.
- [ ] **4.3. `TelemetryCharts` (Vẽ đồ thị)**
  * Sử dụng thư viện `uPlot` (hoặc canvas 2D thủ công) vẽ biểu đồ trơn tru cho Gia tốc X/Y/Z, Con quay hồi chuyển X/Y/Z, Nhiệt độ và Điện áp.
- [ ] **4.4. `OrbitMap` (Bản đồ thế giới & Quỹ đạo)**
  * Sử dụng 2D Canvas vẽ các đa giác đất liền từ `natural-earth-land-110m.js`.
  * Hiển thị vị trí trạm, vệ tinh và vẽ quỹ đạo dự báo của vệ tinh.
- [ ] **4.5. `Antenna3D` (Mô phỏng ăng-ten 3D)**
  * Sử dụng `@react-three/fiber` để vẽ đĩa ăng-ten, trục nâng, chân đế.
  * Ánh xạ góc quay của đĩa ăng-ten 3D theo góc Azimuth và Elevation thực tế của vệ tinh.
- [ ] **4.6. `Esp32S3Flasher` (Bộ nạp chương trình)**
  * Sử dụng `esptool-js` để thiết lập quy trình nạp chip target `esp32s3`.
  * Hỗ trợ kéo thả các file nhị phân: `bootloader.bin` (tại `0x0`), `partitions.bin` (tại `0x8000`), và `app.bin` (tại `0x10000`).

---

## 🧪 Giai đoạn 5: Tối ưu hóa, Kiểm thử & Đóng gói
- [ ] **5.1. Chống nghẽn dữ liệu (Throttling)**
  * Batch/Gom dữ liệu cảm biến nhận được từ Web Serial rồi cập nhật UI đồng loạt mỗi 100ms thay vì cập nhật liên tục 60 lần/giây để tránh làm React bị treo.
- [ ] **5.2. Chức năng Xuất dữ liệu**
  * Thêm nút xuất file `.csv` lưu lại toàn bộ telemetry đã ghi được trong phiên làm việc.
- [ ] **5.3. Kiểm thử với phần cứng ESP32-S3 thật**
  * Kết nối mạch ESP32-S3 qua USB, kiểm tra Web Serial nhận diện cổng và đọc được luồng tin.
  * Test tính năng nạp file `.bin` xem ESP32-S3 có tự động nạp thành công hay không.
- [ ] **5.4. Đóng gói ứng dụng (Production Build)**
  * Chạy lệnh: `npm run build` để xuất ra các file HTML/JS/CSS tĩnh trong thư mục `dist/`.
  * Deploy lên GitHub Pages hoặc Vercel để sử dụng trực tuyến.
