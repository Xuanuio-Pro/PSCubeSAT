// True when the sketch is still the empty starter: only includes, Serial.begin and delay inside an
// empty setup()/loop(). Used to offer "Bắt đầu từ mã mẫu?" without ever replacing a student's own code.
export function isBlankSketch(code) {
  if (code == null) return true;
  const body = String(code)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/^\s*#include\s*[<"][^>"]+[>"]\s*$/gm, '')
    .replace(/\bSerial\.begin\(\s*\d+\s*\)\s*;/g, '')
    .replace(/\bdelay\(\s*\d+\s*\)\s*;/g, '')
    .replace(/\s+/g, '');
  return body === '' || body === 'voidsetup(){}voidloop(){}';
}
