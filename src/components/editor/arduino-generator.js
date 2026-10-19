import * as Blockly from 'blockly';
import { allowedBlockTypes, registerCustomBlocks } from './blockly-toolbox.js';

const resources = {
  sensor: ['PTIT_Sensor', 'sensor'], eps: ['PTIT_EPS', 'eps'], gps: ['PTIT_GPS', 'gps'],
  com: ['PTIT_COM', 'lora'], storage: ['PTIT_Storage', 'storage'], camera: ['PTIT_Camera', 'camera'], cdh: ['PTIT_CDH', 'cdh'],
};
const resourceFor = type => type.startsWith('imu_') ? 'sensor' : Object.keys(resources).find(key => type.startsWith(`${key}_`));
const active = block => block.isEnabled() && !block.getInheritedDisabled();
const roots = new Set(['arduino_setup', 'arduino_loop']);

export function cppString(value) {
  return '"' + Array.from(String(value), char => {
    if (char === '"' || char === '\\') return '\\' + char;
    if (char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) return '\\' + char.charCodeAt(0).toString(8).padStart(3, '0');
    return char;
  }).join('') + '"';
}

class ArduinoGenerator extends Blockly.CodeGenerator {
  used = new Set();
  variables = new Map();
  explicitInit = new Set();
  counter = 0;
  constructor() {
    super('Arduino');
    this.INDENT = '  ';
  }
  init(workspace) {
    this.isInitialized = true;
    this.used.clear();
    this.explicitInit.clear();
    this.variables.clear();
    this.counter = 0;
    for (const block of workspace.getAllBlocks(false).filter(active)) {
      const resource = resourceFor(block.type);
      if (resource) this.used.add(resource);
      if (block.type.endsWith('_init')) this.explicitInit.add(resource);
      const field = block.getField('VAR');
      if (field && !this.variables.has(field.getValue())) this.variables.set(field.getValue(), `cube_var_${this.variables.size}`);
    }
  }
  finish(code) {
    this.isInitialized = false;
    const declarations = [...this.used].map(key => `${resources[key][0]} ${resources[key][1]};`).join('\n');
    const vars = [...this.variables.values()].map(name => `double ${name} = 0;`).join('\n');
    return `// PTIT CubeSat · sinh từ Blockly\n#include <Arduino.h>\n#include <math.h>\n${this.used.size ? '#include "PTITCube.h"\n' : ''}${this.used.has('camera') ? '#include <SD.h>\n' : ''}\n${declarations}\n${vars}\n${this.telemetryHelper()}\n${code}`;
  }
  scrub_(block, code, thisOnly = false) {
    return code + (thisOnly ? '' : this.blockToCode(block.getNextBlock()));
  }
  value(block, name, fallback = '0') { return this.valueToCode(block, name, 99) || fallback; }
  variable(block) { return this.variables.get(block.getFieldValue('VAR')); }
  autoInit() {
    return [...this.used].filter(key => !this.explicitInit.has(key)).map(key => `  ${resources[key][1]}.init(${key === 'camera' ? '12, 14' : ''});\n`).join('');
  }
  updates() {
    return ['sensor', 'eps', 'gps', 'cdh'].filter(key => this.used.has(key)).map(key => `  ${key}.update();\n`).join('');
  }
  telemetryHelper() {
    return String.raw`// Giá trị không có được gửi dưới dạng null.
void cube_json_number(const char* key, double value) {
  Serial.print(",\""); Serial.print(key); Serial.print("\":");
  if (isfinite(value)) Serial.print(value, 6); else Serial.print("null");
}
`;
  }
}

export const arduinoGenerator = new ArduinoGenerator();
/** @returns {[string, number]} */
const expression = code => [code, 0];
const gen = arduinoGenerator.forBlock;
gen.arduino_setup = (b, g) => `void setup() {\n  Serial.begin(115200);\n${g.autoInit()}${g.statementToCode(b, 'DO')}}\n\n`;
gen.arduino_loop = (b, g) => `void loop() {\n${g.updates()}${g.statementToCode(b, 'DO')}  delay(1); // Nhường CPU cho hệ thống ESP32\n}\n`;
gen.math_number = b => expression(String(Number(b.getFieldValue('NUM'))));
gen.text = b => expression(`String(${cppString(b.getFieldValue('TEXT'))})`);
gen.logic_boolean = b => expression(b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false');
gen.logic_negate = (b, g) => expression(`(!(${g.value(b, 'BOOL', 'false')}))`);
gen.logic_compare = (b, g) => expression(`(${g.value(b, 'A')} ${{ EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' }[b.getFieldValue('OP')]} ${g.value(b, 'B')})`);
gen.logic_operation = (b, g) => expression(`(${g.value(b, 'A', 'false')} ${b.getFieldValue('OP') === 'AND' ? '&&' : '||'} ${g.value(b, 'B', 'false')})`);
gen.math_arithmetic = (b, g) => {
  const a = g.value(b, 'A'), c = g.value(b, 'B'), op = b.getFieldValue('OP');
  if (op === 'POWER') return expression(`pow(${a}, ${c})`);
  // Cast division to double: 1 / 2 must produce 0.5, not integer truncation.
  return expression(`(${op === 'DIVIDE' ? `(double)(${a})` : a} ${{ ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/' }[op]} ${c})`);
};
gen.math_modulo = (b, g) => expression(`fmod(${g.value(b, 'DIVIDEND')}, ${g.value(b, 'DIVISOR')})`);
gen.variables_get = (b, g) => expression(g.variable(b));
gen.variables_set = (b, g) => `${g.variable(b)} = ${g.value(b, 'VALUE')};\n`;
gen.math_change = (b, g) => `${g.variable(b)} += ${g.value(b, 'DELTA')};\n`;
gen.text_join = (b, g) => {
  const inputs = b.inputList.filter(input => input.name.startsWith('ADD'));
  return expression(`(String("")${inputs.map(input => ` + String(${g.value(b, input.name, '""')})`).join('')})`);
};
gen.text_print = (b, g) => `Serial.println(${g.value(b, 'TEXT', '""')});\n`;
gen.serial_print = (b, g) => `Serial.println(${g.value(b, 'VALUE', '""')});\n`;
gen.controls_if = (b, g) => {
  let code = '', i = 0;
  while (b.getInput(`IF${i}`)) {
    code += `${i ? ' else ' : ''}if (${g.value(b, `IF${i}`, 'false')}) {\n${g.statementToCode(b, `DO${i}`)}}`;
    i++;
  }
  if (b.getInput('ELSE')) code += ` else {\n${g.statementToCode(b, 'ELSE')}}`;
  return code + '\n';
};
gen.controls_repeat_ext = (b, g) => {
  const id = g.counter++;
  return `{\n  const double cube_count_${id} = ${g.value(b, 'TIMES')};\n  for (double cube_i_${id} = 0; cube_i_${id} < cube_count_${id}; ++cube_i_${id}) {\n${g.prefixLines(g.statementToCode(b, 'DO'), '  ')}    delay(1);\n  }\n}\n`;
};
gen.controls_whileUntil = (b, g) => `while (${b.getFieldValue('MODE') === 'UNTIL' ? '!' : ''}(${g.value(b, 'BOOL', 'false')})) {\n${g.statementToCode(b, 'DO')}  delay(1);\n}\n`;
gen.controls_for = (b, g) => {
  const id = g.counter++, v = g.variable(b);
  return `{\n  const double cube_from_${id} = ${g.value(b, 'FROM')};\n  const double cube_to_${id} = ${g.value(b, 'TO')};\n  const double cube_step_${id} = fabs(${g.value(b, 'BY')});\n  const bool cube_up_${id} = cube_from_${id} <= cube_to_${id};\n  for (${v} = cube_from_${id}; cube_step_${id} > 0 && (cube_up_${id} ? ${v} <= cube_to_${id} : ${v} >= cube_to_${id}); ${v} += cube_up_${id} ? cube_step_${id} : -cube_step_${id}) {\n${g.prefixLines(g.statementToCode(b, 'DO'), '  ')}    delay(1);\n  }\n}\n`;
};
gen.pin_mode = b => `pinMode(${b.getFieldValue('PIN')}, ${b.getFieldValue('MODE')});\n`;
gen.digital_write = b => `digitalWrite(${b.getFieldValue('PIN')}, ${b.getFieldValue('STATE')});\n`;
gen.digital_read = b => expression(`digitalRead(${b.getFieldValue('PIN')})`);
gen.analog_read = b => expression(`analogRead(${b.getFieldValue('PIN')})`);
gen.delay_ms = b => `delay(${b.getFieldValue('MS')});\n`;
gen.millis_value = () => expression('millis()');
for (const [key, [, object]] of Object.entries(resources)) gen[`${key}_init`] = () => `${object}.init();\n`;
gen.camera_init = b => `camera.init(${b.getFieldValue('CONNECTION') === 'DIRECT' ? '255, 255' : '12, 14'});\n`;
gen.sensor_init = b => `sensor.init(${({ ENV: 'true, false, false', IMU: 'false, true, true' })[b.getFieldValue('SENSORS')] || ''});\n`;
for (const key of ['sensor', 'eps', 'cdh']) gen[`${key}_update`] = () => `${key}.update();\n`;
for (const [type, code] of Object.entries({
  sensor_read_temp: 'sensor.getTemperature()', sensor_read_pressure: 'sensor.getPressure()',
  eps_read_voltage: 'eps.getBatteryVoltage()', eps_read_percent: 'eps.getBatteryPercent()',
  gps_has_fix: 'gps.hasFix()', com_receive: 'lora.update()',
})) gen[type] = () => expression(code);
gen.gps_read = () => 'gps.selectGPS();\ngps.update();\n';
gen.gps_value = b => expression(`(gps.hasFix() ? gps.get${b.getFieldValue('AXIS')}() : NAN)`);
const imuExpr = axis => `(sensor.get${axis}()${axis.startsWith('Acc') ? ' / 9.80665' : axis.startsWith('Gyro') ? ' * 57.2957795131' : ''})`;
gen.imu_value = b => expression(imuExpr(b.getFieldValue('AXIS')));
for (const [type, prefix] of [['imu_read_acc', 'Acc'], ['imu_read_gyro', 'Gyro'], ['imu_read_mag', 'Mag']]) {
  gen[type] = () => `sensor.update();\nSerial.printf("${prefix}: %.3f, %.3f, %.3f\\n", ${['X', 'Y', 'Z'].map(axis => imuExpr(prefix + axis)).join(', ')});\n`;
}
gen.com_send = (b, g) => `lora.sendMessage(String(${g.value(b, 'VALUE', '""')}));\n`;
gen.storage_log = (b, g) => `storage.logData(String(${g.value(b, 'VALUE', '""')}).c_str());\n`;
gen.camera_capture = () => `{
  static unsigned long cube_image_index = 0;
  String cube_image_path;
  do {
    cube_image_path = "/photos/blockly_" + String(cube_image_index++) + ".jpg";
  } while (SD.exists(cube_image_path.c_str()) || SD.exists((cube_image_path + ".part").c_str()));
  if (camera.captureToFile(cube_image_path.c_str())) Serial.println("[Camera] OK: " + cube_image_path);
  else Serial.println("[Camera] Khong chup duoc anh");
}
`;
gen.telemetry_send = (b, g) => {
  let code = `Serial.print(${cppString(JSON.stringify({ type: 'telemetry', schema_version: 1, device_id: b.getFieldValue('DEVICE'), source: 'hardware' }).slice(0, -1))});\ncube_json_number("uptimeMs", millis());\n`;
  if (g.used.has('eps')) code += 'cube_json_number("voltageV", eps.getBatteryVoltage());\n';
  if (g.used.has('sensor')) {
    code += 'cube_json_number("temperatureC", sensor.getTemperature());\ncube_json_number("pressureHpa", sensor.getPressure());\n';
    for (const prefix of ['Acc', 'Gyro', 'Mag']) for (const axis of ['X', 'Y', 'Z']) code += `cube_json_number("${prefix.toLowerCase()}${axis}", ${imuExpr(prefix + axis)});\n`;
  }
  if (g.used.has('gps')) for (const [key, method] of [['gpsLat', 'Lat'], ['gpsLon', 'Lng'], ['gpsAlt', 'Altitude']]) code += `cube_json_number("${key}", gps.hasFix() ? gps.get${method}() : NAN);\n`;
  return code + 'Serial.println("}");\n';
};

export function generateArduino(workspace, labId = 8) {
  registerCustomBlocks();
  const issues = [];
  const allowed = allowedBlockTypes(labId);
  const blocks = workspace.getAllBlocks(false).filter(active);
  const counts = new Map();
  let blockCount = 0;
  for (const block of blocks) {
    counts.set(block.type, (counts.get(block.type) || 0) + 1);
    if (!block.isShadow()) blockCount++;
  }
  const add = (block, message) => issues.push({ blockId: block?.id, message });
  for (const type of roots) {
    if (counts.get(type) !== 1) add(null, `Cần đúng một block ${type === 'arduino_setup' ? 'Khởi tạo' : 'Lặp liên tục'}.`);
  }
  for (const b of blocks) {
    if (!allowed.has(b.type) || !gen[b.type]) { add(b, `Block ${b.type} chưa được hỗ trợ trong Lab ${labId}.`); continue; }
    if (!roots.has(b.type) && !b.getParent()) add(b, 'Block rời chưa được nối vào chương trình.');
    if (roots.has(b.type) && b.getParent()) add(b, 'Block chương trình phải nằm ở ngoài cùng.');
    if (b.type.endsWith('_init') && b.getSurroundParent()?.type !== 'arduino_setup') add(b, 'Đặt block khởi tạo phân hệ trực tiếp trong vùng Khởi tạo.');
    if (b.type.endsWith('_init') && counts.get(b.type) > 1) add(b, 'Mỗi phân hệ chỉ cần một block khởi tạo.');
    for (const input of b.inputList) for (const field of input.fieldRow) if (field instanceof Blockly.FieldNumber && !Number.isFinite(Number(field.getValue()))) add(b, 'Giá trị số phải hữu hạn.');
    for (const input of b.inputList) if (input.type === Blockly.inputs.inputTypes.VALUE && !input.connection.targetBlock()) add(b, `Thiếu giá trị tại ${input.name}.`);
    if (b.type === 'telemetry_send' && !/^[A-Za-z0-9_-]{1,64}$/.test(b.getFieldValue('DEVICE'))) add(b, 'Mã thiết bị gồm 1–64 chữ, số, dấu gạch ngang hoặc gạch dưới.');
    if (b.type === 'controls_for' && b.getInputTargetBlock('BY')?.type === 'math_number' && Number(b.getInputTargetBlock('BY').getFieldValue('NUM')) === 0) add(b, 'Bước nhảy của vòng lặp phải khác 0.');
  }
  if (issues.length) return { code: '', issues, blockCount };
  try { return { code: arduinoGenerator.workspaceToCode(workspace), issues, blockCount }; }
  catch (error) { return { code: '', issues: [{ blockId: null, message: `Không thể sinh C++: ${error.message}` }], blockCount }; }
}
