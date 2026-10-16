// Local API-compatible version; upstream https://github.com/PTITCube/Lab7-02_Full_Satellite_Program
/**
 * @file 1_Full_System_Telemetry.cpp
 * @brief Ví dụ tổng hợp toàn bộ các phân hệ của vệ tinh CubeSat.
 * 
 * Mô tả:
 * - Khởi tạo toàn bộ các module: EPS (Nguồn), Sensor (Gia tốc, Góc quay, Áp suất, Từ trường),
 *   GPS (Định vị), Camera (Hình ảnh), Storage (Thẻ MicroSD), COM (LoRa).
 * - Thu thập dữ liệu từ tất cả các cảm biến.
 * - Đóng gói dữ liệu thành định dạng JSON.
 * - Gửi chuỗi JSON về trạm mặt đất qua LoRa và lưu vào thẻ nhớ.
 * 
 * Lưu ý:
 * - Trong môi trường thực tế, tác vụ này nên được chạy đa luồng bằng FreeRTOS 
 *   như bản firmware đầy đủ để tránh block hệ thống, nhưng trong ví dụ này
 *   ta dùng vòng lặp tuần tự (Sequential loop) cho dễ hiểu.
 */

#include <Arduino.h>
#include <ArduinoJson.h>
#include <PTITCube.h>


// Khởi tạo các phân hệ
PTIT_EPS eps;
PTIT_Sensor sensor;
PTIT_GPS gps;
PTIT_Camera camera;
PTIT_Storage storage;
PTIT_COM com;

unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL = 5000; // 5 giây gửi telemetry 1 lần

void setup() {
    Serial.begin(115200);
    delay(2000);
    
    Serial.println("\n--- KHỞI TẠO HỆ THỐNG VỆ TINH TOÀN DIỆN ---");

    // Khởi tạo các phân hệ
    Serial.print("1. Khởi tạo EPS... ");
    eps.init();
    Serial.println("Init returned; inspect subsystem status above.");

    Serial.print("2. Khởi tạo Sensor... ");
    sensor.init();
    Serial.println("Init returned; inspect subsystem status above.");

    Serial.print("3. Khởi tạo GPS... ");
    gps.init();
    Serial.println("Init returned; inspect subsystem status above.");

    Serial.print("4. Khởi tạo Storage (MicroSD)... ");
    storage.init();
    Serial.println("Init returned; inspect subsystem status above.");

    Serial.print("5. Khởi tạo Camera... ");
    camera.init(12, 14); // Sử dụng chân chọn MUX
    Serial.println("Init returned; inspect subsystem status above.");

    Serial.print("6. Khởi tạo COM (LoRa)... ");
    com.init();
    Serial.println("Init returned; inspect subsystem status above.");

    Serial.println("\n--- VỆ TINH ĐÃ SẴN SÀNG ---");
}

void loop() {
    // 1. Cập nhật dữ liệu từ các cảm biến định kì
    sensor.update();
    
    // Bật kênh GPS để lấy vị trí
    camera.selectGPS();
    gps.update();

    unsigned long currentMillis = millis();

    // 2. Gửi Telemetry sau mỗi khoảng thời gian định trước
    if (currentMillis - lastTelemetryTime >= TELEMETRY_INTERVAL) {
        lastTelemetryTime = currentMillis;
        
        Serial.println("\n--- ĐANG ĐÓNG GÓI TELEMETRY ---");

        // Tạo Document JSON
        JsonDocument doc;

        // Dữ liệu Nguồn (EPS)
        JsonObject epsObj = doc["eps"].to<JsonObject>();
        epsObj["batt_v"] = eps.getBatteryVoltage();
        epsObj["batt_pct"] = eps.getBatteryPercent();
        // No system-voltage measurement API is available; do not invent a value.

        // Dữ liệu Cảm biến môi trường (Sensor)
        JsonObject envObj = doc["env"].to<JsonObject>();
        envObj["temp"] = sensor.getTemperature();
        envObj["press"] = sensor.getPressure();


        // Raw acceleration and angular rate; no fused attitude API is available.
        JsonObject imuObj = doc["imu"].to<JsonObject>();
        imuObj["ax_ms2"] = sensor.getAccX();
        imuObj["ay_ms2"] = sensor.getAccY();
        imuObj["az_ms2"] = sensor.getAccZ();
        imuObj["gx_rads"] = sensor.getGyroX();
        imuObj["gy_rads"] = sensor.getGyroY();
        imuObj["gz_rads"] = sensor.getGyroZ();

        // Dữ liệu Định vị (GPS)
        if (gps.hasFix()) {
            JsonObject gpsObj = doc["gps"].to<JsonObject>();
            gpsObj["lat"] = gps.getLatitude();
            gpsObj["lng"] = gps.getLongitude();
            gpsObj["alt"] = gps.getAltitude();
            gpsObj["sats"] = gps.getSatellites();
        }

        // Chuyển đổi JSON thành chuỗi (String)
        String telemetryString;
        serializeJson(doc, telemetryString);

        Serial.println("Dữ liệu thu thập được:");
        Serial.println(telemetryString);

        // 3. Gửi dữ liệu qua LoRa về Trái Đất
        Serial.print("Đang gửi qua LoRa... ");
        com.sendMessage(telemetryString);
        Serial.println("Send requested; this API does not confirm reception/ACK.");

        // 4. Lưu log vào thẻ nhớ làm "Hộp đen" dự phòng
        Serial.print("Đang lưu log vào thẻ nhớ... ");
        // Đảm bảo dạng text có dấu xuống dòng
        telemetryString += "\n"; 
        bool saved = storage.appendFile("/datalog.txt", telemetryString.c_str());
        Serial.println(saved ? "SD write OK" : "SD write failed/not ready");
    }
    delay(10);
}
