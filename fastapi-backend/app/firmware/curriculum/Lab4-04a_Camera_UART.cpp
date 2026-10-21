// PTIT ESP32 OBC UART camera example. Camera slave must support CAPTURE/SIZE/OK/DONE.
// Upstream: https://github.com/PTITCube/Lab4-04a_Camera_UART
#include <Arduino.h>
#include <mbedtls/base64.h>

bool capturePreview() {
    while (Serial2.available()) Serial2.read();
    Serial.println("[Camera] Dang chup: UART raw preview");
    Serial2.print("CAPTURE\n");
    String header;
    uint32_t size = 0;
    const uint32_t started = millis();
    while (millis() - started < 5000) {
        if (!Serial2.available()) { delay(1); continue; }
        char c = Serial2.read();
        if (c == '\n') {
            header.trim();
            if (header.startsWith("SIZE:")) { size = header.substring(5).toInt(); break; }
            if (header.startsWith("ERROR:")) { Serial.println(header); return false; }
            header = "";
        } else if (header.length() < 128) header += c;
        else { Serial.println("ERROR:CAPTURE_HEADER"); return false; }
    }
    // Keep the preview inside the browser's bounded image protocol. Larger captures use SD examples.
    if (size < 4 || size > 32768) {
        Serial.printf("ERROR:CAPTURE_SIZE:%u (preview limit 32768 bytes; use SD capture for larger JPEG)\n", size);
        return false; // Do not acknowledge bytes we cannot store.
    }
    uint8_t* jpeg = static_cast<uint8_t*>(malloc(size));
    if (!jpeg) { Serial.println("ERROR:CAPTURE_MEMORY"); return false; }
    Serial2.print("OK\n");
    uint32_t received = 0;
    const uint32_t transferStarted = millis();
    while (received < size && millis() - transferStarted < 15000) {
        while (Serial2.available() && received < size) jpeg[received++] = Serial2.read();
        delay(1);
    }
    Serial2.print("DONE\n");
    const bool valid = received == size && jpeg[0] == 0xff && jpeg[1] == 0xd8 && jpeg[size - 2] == 0xff && jpeg[size - 1] == 0xd9;
    if (!valid) { free(jpeg); Serial.println("ERROR:CAPTURE_TRUNCATED_OR_INVALID_JPEG"); return false; }
    const size_t capacity = 4 * ((size + 2) / 3) + 1;
    auto* encoded = static_cast<unsigned char*>(malloc(capacity));
    size_t written = 0;
    const bool encodedOK = encoded && mbedtls_base64_encode(encoded, capacity, &written, jpeg, size) == 0;
    free(jpeg);
    if (!encodedOK) { free(encoded); Serial.println("ERROR:CAPTURE_BASE64"); return false; }
    Serial.print("IMG:");
    Serial.write(encoded, written);
    Serial.println();
    free(encoded);
    return true;
}

void setup() {
    Serial.begin(115200);
    pinMode(12, OUTPUT); pinMode(14, OUTPUT);
    digitalWrite(12, LOW); digitalWrite(14, HIGH); // Select camera, not GPS.
    Serial2.begin(115200, SERIAL_8N1, 16, 17);
    delay(2000);
    Serial.println("[RAW] UART2 camera preview; send p to capture again.");
    capturePreview();
}

void loop() {
    if (Serial.available()) {
        const char command = Serial.read();
        if (command == 'p' || command == 'P') capturePreview();
    }
    delay(5);
}
