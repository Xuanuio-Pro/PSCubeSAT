#ifndef PTIT_CLOUD_H
#define PTIT_CLOUD_H

#include <Arduino.h>

/**
 * PTITCloud — platform overlay, not part of the student-facing API.
 *
 * Sends every new JPEG saved under /photos on the SD card to the platform server over MQTT
 * (`sensors/<uid>/image`), so the Camera Viewer shows photos without any upload code in the sketch.
 *
 * Configuration (WiFi + MQTT) is written by the web app over Serial and kept in NVS:
 *   board  -> "[CLOUD] CFG? v1 uid=<uid|none> ssid=<ssid>"   (at cdh.begin(), and on "@PTITCLOUD ?")
 *   web    -> "@PTITCLOUD {json}" | "@PTITCLOUD KEEP" | "@PTITCLOUD CLEAR"
 *   board  -> "[CLOUD] CFG OK uid=<uid>" | "[CLOUD] CFG ERR <reason>"
 * Progress lines: "[CLOUD] PHOTO SENT <path> <bytes>", "[CLOUD] PHOTO FAIL <path> <reason>".
 * Lines starting with "@PTITCLOUD" never reach the sketch through cdh.read().
 */
namespace ptit_cloud {
void begin(Stream& console);
int available(Stream& console);
int read(Stream& console);
int peek(Stream& console);
}  // namespace ptit_cloud

#endif  // PTIT_CLOUD_H
