# Doc 1.5: IC 74HC595 và LED 7 đoạn

### 1. Cách hoạt động của IC 74HC595

IC **74HC595** chuyển dữ liệu nối tiếp thành 8 ngõ ra song song. Bên trong có thanh ghi dịch và thanh ghi chốt:

![Cấu trúc vi mạch ghi dịch 74HC595 và LED 7 đoạn](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab1_74hc595_structure.png)

- **Thanh ghi dịch:** Mỗi cạnh lên trên `SH_CP` ghi bit tại `DS` vào thanh ghi và đẩy các bit trước đó sang vị trí kế tiếp.
- **Thanh ghi chốt:** Giữ nguyên trạng thái các ngõ ra `Q0`–`Q7` trong lúc nạp dữ liệu. Cạnh lên tại `ST_CP` chuyển đồng thời 8 bit sang ngõ ra, tránh nhấp nháy LED khi dịch dữ liệu.

### 2. Điều khiển LED 7 đoạn

LED 7 đoạn gồm các đoạn `a`–`g` và chấm thập phân `dp`. Có hai kiểu đấu: anode chung và cathode chung.

- Với loại **cathode chung**, xuất mức **HIGH (1)** để bật một đoạn và **LOW (0)** để tắt.
- Bảng mã dưới đây hiển thị các chữ số 0–9. Thứ tự bit `Q7`–`Q0` tương ứng `dp, g, f, e, d, c, b, a`.

| Số | Các đoạn bật | Mã nhị phân (`dp-g-f-e-d-c-b-a`) | Mã hexa |
| :---------: | :---------------------: | :-----------------------------------------: | :-------------: |
| **0** |  $a, b, c, d, e, f$  |                `00111111`                |    `0x3F`    |
| **1** |        $b, c$        |                `00000110`                |    `0x06`    |
| **2** |    $a, b, d, e, g$    |                `01011011`                |    `0x5B`    |
| **3** |    $a, b, c, d, g$    |                `01001111`                |    `0x4F`    |
| **4** |     $b, c, f, g$     |                `01100110`                |    `0x66`    |
| **5** |    $a, c, d, f, g$    |                `01101101`                |    `0x6D`    |
| **6** |  $a, c, d, e, f, g$  |                `01111101`                |    `0x7D`    |
| **7** |       $a, b, c$       |                `00000111`                |    `0x07`    |
| **8** | $a, b, c, d, e, f, g$ |                `01111111`                |    `0x7F`    |
| **9** |  $a, b, c, d, f, g$  |                `01101111`                |    `0x6F`    |
