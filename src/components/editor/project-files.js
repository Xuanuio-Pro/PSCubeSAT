// Storage keys, starter C++ and file download: kept free of Blockly so pages that only
// download a sketch or open the C++ editor do not load the ~1 MB Blockly bundle.
const exerciseSuffix = exerciseId => exerciseId ? `:exercise:${encodeURIComponent(exerciseId)}` : '';
export const projectKey = (labId, exerciseId = '', scope = '') => `ptit:blockly:v1:lab:${labId}${exerciseSuffix(exerciseId)}${scope ? `:scope:${encodeURIComponent(scope)}` : ''}`;
export const sourceKey = (labId, exerciseId = '', scope = '') => `ptit:source:v1:lab:${labId}${exerciseSuffix(exerciseId)}${scope ? `:scope:${encodeURIComponent(scope)}` : ''}`;
// Exercises renamed or moved between labs: [old lab, old id]. Drafts saved under the old key stay readable.
const LEGACY_EXERCISES = {
  'Lab1-06_Serial_Communication': [1, 'Lab1-02_Serial_Communication'], 'Lab1-07_Serial_Control_LED': [1, 'Lab1-03_Serial_Control_LED'],
  'Lab2-01a_Battery_I2C': [2, 'Lab2-01a_Battery_GPIO'],
  'Lab1-08_WiFi_Connection': [1, 'Lab1-04_WiFi_Connection'], 'Lab1-09_WiFi_AP_Mode': [1, 'Lab1-05_WiFi_AP_Mode'], 'Lab1-10_Web_Server_LED': [1, 'Lab1-06_Web_Server_LED'],
  'Lab3-03_Multitasking_Scheduler': [6, 'Lab6-01_Multitasking_Scheduler'], 'Lab3-04_Watchdog_And_Event': [6, 'Lab6-02_Watchdog_And_Event'],
  'Lab4-06_Camera_Multiplexer': [7, 'Lab7-01_Camera_Multiplexer'],
  'Lab7-01_Full_Satellite_Program': [7, 'Lab7-02_Full_Satellite_Program'], 'Lab7-02_RTOS_Satellite_System': [7, 'Lab7-03_RTOS_Satellite_System'],
};
export const loadDraft = (keyFor, labId, exerciseId, scope = '') => {
  const old = LEGACY_EXERCISES[exerciseId];
  return localStorage.getItem(keyFor(labId, exerciseId, scope)) ?? (old ? localStorage.getItem(keyFor(old[0], old[1], scope)) : null);
};
export const DEFAULT_ARDUINO_CODE = '#include <Arduino.h>\n#include <math.h>\n\nvoid setup() {\n  Serial.begin(115200);\n}\n\nvoid loop() {\n  delay(1000);\n}\n';

export function downloadFile(name, contents, mime = 'application/json') {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
