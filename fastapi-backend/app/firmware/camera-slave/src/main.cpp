#include <Arduino.h>
#include "esp_camera.h"

// Cấu hình chân cho module AI Thinker ESP32-CAM
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22
#define FLASH_LED_GPIO     4
static bool cameraReady = false;
static esp_err_t cameraInitError = ESP_FAIL;

static void sendCaptureError(const char* message) {
    Serial.print("ERROR:");
    Serial.println(message);
}

void setup() {
    pinMode(FLASH_LED_GPIO, OUTPUT);
    digitalWrite(FLASH_LED_GPIO, LOW);

    Serial.begin(115200);
    Serial.setTimeout(250);
    delay(1000);
    Serial.println("Khoi dong ESP32-CAM...");

    camera_config_t config = {};
    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer = LEDC_TIMER_0;
    config.pin_d0 = Y2_GPIO_NUM;
    config.pin_d1 = Y3_GPIO_NUM;
    config.pin_d2 = Y4_GPIO_NUM;
    config.pin_d3 = Y5_GPIO_NUM;
    config.pin_d4 = Y6_GPIO_NUM;
    config.pin_d5 = Y7_GPIO_NUM;
    config.pin_d6 = Y8_GPIO_NUM;
    config.pin_d7 = Y9_GPIO_NUM;
    config.pin_xclk = XCLK_GPIO_NUM;
    config.pin_pclk = PCLK_GPIO_NUM;
    config.pin_vsync = VSYNC_GPIO_NUM;
    config.pin_href = HREF_GPIO_NUM;
    config.pin_sccb_sda = SIOD_GPIO_NUM;
    config.pin_sccb_scl = SIOC_GPIO_NUM;
    config.pin_pwdn = PWDN_GPIO_NUM;
    config.pin_reset = RESET_GPIO_NUM;
    config.xclk_freq_hz = 20000000;
    config.pixel_format = PIXFORMAT_JPEG;
    config.frame_size = psramFound() ? FRAMESIZE_VGA : FRAMESIZE_QVGA;
    config.fb_location = psramFound() ? CAMERA_FB_IN_PSRAM : CAMERA_FB_IN_DRAM;
    config.jpeg_quality = 10;
    config.fb_count = 1;

    esp_err_t err = esp_camera_init(&config);
    cameraInitError = err;
    cameraReady = err == ESP_OK;
    if (err != ESP_OK) {
        Serial.printf("ERROR:CAMERA_INIT:0x%x\n", err);
        return;
    }
    
    Serial.println("Camera init OK.");
    Serial.println("CAMERA_READY");
}

void loop() {
    if (Serial.available() == 0) {
        delay(1);
        return;
    }

    String command = Serial.readStringUntil('\n');
    command.trim();

    if (command == "STATUS") {
        Serial.printf("STATUS:ready=%d,init=0x%x,psram=%d,heap=%u\n", cameraReady, cameraInitError, psramFound(), ESP.getFreeHeap());
        return;
    }
    if (command != "CAPTURE") {
        return;
    }

    if (!cameraReady) {
        Serial.printf("ERROR:CAMERA_INIT:0x%x\n", cameraInitError);
        return;
    }
    camera_fb_t* frame = esp_camera_fb_get();
    if (frame == nullptr) {
        sendCaptureError("CAPTURE");
        return;
    }
    if (frame->len < 4 || frame->len > 512 * 1024 || frame->buf[0] != 0xFF || frame->buf[1] != 0xD8 ||
        frame->buf[frame->len - 2] != 0xFF || frame->buf[frame->len - 1] != 0xD9) {
        sendCaptureError("INVALID_JPEG");
        esp_camera_fb_return(frame);
        return;
    }

    digitalWrite(FLASH_LED_GPIO, HIGH);
    Serial.printf("SIZE:%u\n", frame->len);

    unsigned long startTime = millis();
    bool ready = false;
    while (millis() - startTime < 5000) {
        if (Serial.available()) {
            String response = Serial.readStringUntil('\n');
            response.trim();
            if (response == "OK") {
                ready = true;
                break;
            }
        }
        delay(1);
    }

    if (!ready) {
        sendCaptureError("ACK_TIMEOUT");
        digitalWrite(FLASH_LED_GPIO, LOW);
        esp_camera_fb_return(frame);
        return;
    }

    Serial.write(frame->buf, frame->len);
    Serial.flush();

    startTime = millis();
    while (millis() - startTime < 15000) {
        if (Serial.available()) {
            String response = Serial.readStringUntil('\n');
            response.trim();
            if (response == "DONE") {
                break;
            }
        }
        delay(1);
    }

    digitalWrite(FLASH_LED_GPIO, LOW);
    esp_camera_fb_return(frame);
}
