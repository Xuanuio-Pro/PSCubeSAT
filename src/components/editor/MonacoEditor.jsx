import Editor from '@monaco-editor/react';

const DEFAULT_CODE = `#include <Arduino.h>
#include "PTITCube.h"

// === Khai báo đối tượng ===
PTIT_Sensor sensor;
PTIT_GPS gps;
PTIT_COM lora;
PTIT_EPS eps;
PTIT_Storage storage;

void setup() {
    Serial.begin(115200);
    // Khởi tạo các phân hệ tại đây
}

void loop() {
    // Viết logic chính tại đây
    delay(1000);
}
`;

export default function MonacoEditor({ code, onChange, readOnly = false, height = '400px' }) {
  return (
    <Editor
      height={height}
      defaultLanguage="cpp"
      theme="vs-dark"
      value={code ?? DEFAULT_CODE}
      onChange={onChange}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        tabSize: 4,
        formatOnPaste: true,
        automaticLayout: true,
        suggest: {
          showKeywords: true,
        },
        padding: { top: 8 },
      }}
    />
  );
}
