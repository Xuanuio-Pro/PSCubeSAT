// Build-only camera driver fixture: keep separate from Adafruit's sensor_t headers.
#include <Arduino.h>
#include <esp_camera.h>
void setup() {
    Serial.begin(115200);
    camera_fb_t* frame = esp_camera_fb_get();
    if (frame) esp_camera_fb_return(frame);
}
void loop() { delay(1000); }
