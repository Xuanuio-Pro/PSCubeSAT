// Storage keys, starter C++ and file download: kept free of Blockly so pages that only
// download a sketch or open the C++ editor do not load the ~1 MB Blockly bundle.
const exerciseSuffix = exerciseId => exerciseId ? `:exercise:${encodeURIComponent(exerciseId)}` : '';
export const projectKey = (labId, exerciseId = '', scope = '') => `ptit:blockly:v1:lab:${labId}${exerciseSuffix(exerciseId)}${scope ? `:scope:${encodeURIComponent(scope)}` : ''}`;
export const sourceKey = (labId, exerciseId = '', scope = '') => `ptit:source:v1:lab:${labId}${exerciseSuffix(exerciseId)}${scope ? `:scope:${encodeURIComponent(scope)}` : ''}`;
export const DEFAULT_ARDUINO_CODE = '#include <Arduino.h>\n#include <math.h>\n\nvoid setup() {\n  Serial.begin(115200);\n}\n\nvoid loop() {\n  delay(1000);\n}\n';

export function downloadFile(name, contents, mime = 'application/json') {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
