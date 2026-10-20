import Editor from '@monaco-editor/react';
import { DEFAULT_ARDUINO_CODE } from './blockly-project.js';

export default function MonacoEditor({ code, onChange, readOnly = false, height = '400px' }) {
  return (
    <Editor
      height={height}
      defaultLanguage="cpp"
      theme="vs-dark"
      value={code ?? DEFAULT_ARDUINO_CODE}
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
