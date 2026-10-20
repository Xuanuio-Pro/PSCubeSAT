import * as Blockly from 'blockly';
import 'blockly/blocks';
import * as vi from 'blockly/msg/vi';

let registered = false;
const statement = { previousStatement: null, nextStatement: null };
const numberField = (name, value, max = 48) => ({ type: 'field_number', name, value, min: 0, max, precision: 1 });
const valueInput = (name, check = null) => ({ type: 'input_value', name, ...(check ? { check } : {}) });
const dropdown = (name, options) => ({ type: 'field_dropdown', name, options });

export function registerCustomBlocks() {
  if (registered) return;
  registered = true;
  /** @type {Record<string, string>} */
  const messages = {};
  for (const [key, message] of Object.entries(vi)) if (typeof message === 'string') messages[key] = message;
  Blockly.setLocale(messages);
  const blocks = [
    { type: 'arduino_setup', message0: 'Khởi tạo · chạy một lần %1 %2', args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], colour: '#376b9c' },
    { type: 'arduino_loop', message0: 'Lặp liên tục %1 %2', args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], colour: '#267e77' },
    { type: 'serial_print', message0: 'Serial · in dòng %1', args0: [valueInput('VALUE')], ...statement, colour: '#267e77' },
    { type: 'serial_begin', message0: 'Serial · tốc độ %1 baud', args0: [numberField('BAUD', 115200, 4000000)], ...statement, colour: '#267e77' },
    { type: 'cpp_statement', message0: 'C++ · lệnh %1', args0: [{ type: 'field_input', name: 'CODE', text: 'Serial.println("Hello");' }], ...statement, colour: '#64748b', tooltip: 'Lệnh C++ được giữ nguyên khi chuyển đổi. Trình biên dịch kiểm tra cú pháp C++.' },
    { type: 'cpp_expression', message0: 'C++ · biểu thức %1', args0: [{ type: 'field_input', name: 'CODE', text: '0' }], output: null, colour: '#64748b' },
    { type: 'cpp_globals', message0: 'C++ · khai báo / hàm %1', args0: [{ type: 'field_input', name: 'CODE', text: '// Khai báo toàn cục' }], colour: '#64748b', tooltip: 'Mã C++ ngoài setup/loop; đặt ở ngoài cùng.' },
    { type: 'pin_mode', message0: 'Đặt chân %1 chế độ %2', args0: [numberField('PIN', 2), dropdown('MODE', [['Đầu ra', 'OUTPUT'], ['Đầu vào', 'INPUT'], ['Kéo lên', 'INPUT_PULLUP']])], ...statement, colour: '#267e77' },
    { type: 'digital_write', message0: 'Ghi chân %1 mức %2', args0: [numberField('PIN', 2), dropdown('STATE', [['Bật / HIGH', 'HIGH'], ['Tắt / LOW', 'LOW']])], ...statement, colour: '#267e77' },
    { type: 'digital_read', message0: 'Đọc digital chân %1', args0: [numberField('PIN', 4)], output: 'Number', colour: '#267e77' },
    { type: 'analog_read', message0: 'Đọc ADC chân %1', args0: [numberField('PIN', 34)], output: 'Number', colour: '#267e77' },
    { type: 'delay_ms', message0: 'Chờ %1 mili giây', args0: [numberField('MS', 1000, 3600000)], ...statement, colour: '#267e77' },
    { type: 'millis_value', message0: 'Thời gian chạy (ms)', output: 'Number', colour: '#267e77' },
    { type: 'com_send', message0: 'LoRa · gửi %1', args0: [valueInput('VALUE')], ...statement, colour: '#a37022' },
    { type: 'com_receive', message0: 'LoRa · nhận tin nhắn', output: 'String', colour: '#a37022' },
    { type: 'storage_log', message0: 'SD · ghi dòng %1', args0: [valueInput('VALUE')], ...statement, colour: '#8867a5' },
    { type: 'camera_capture', message0: 'Camera · chụp ảnh vào thẻ SD', ...statement, colour: '#a45e70' },
    { type: 'camera_init', message0: 'Khởi tạo camera · %1', args0: [dropdown('CONNECTION', [['Qua MUX (12/14)', 'MUX'], ['UART trực tiếp', 'DIRECT']])], ...statement, colour: '#a45e70' },
    { type: 'sensor_init', message0: 'Khởi tạo cảm biến · %1', args0: [dropdown('SENSORS', [['Tất cả', 'ALL'], ['Môi trường (BMP280)', 'ENV'], ['IMU (MPU + QMC)', 'IMU']])], ...statement, colour: '#376b9c' },
    { type: 'telemetry_send', message0: 'Gửi telemetry Serial · thiết bị %1', args0: [{ type: 'field_input', name: 'DEVICE', text: 'cubesat-01' }], ...statement, colour: '#376b9c', tooltip: 'Gửi JSON theo schema chung. Chỉ gồm cảm biến được dùng trong chương trình; giá trị lỗi là null.' },
    { type: 'gps_read', message0: 'GPS · cập nhật vị trí', ...statement, colour: '#a37022' },
    { type: 'gps_value', message0: 'GPS · %1', args0: [dropdown('AXIS', [['Vĩ độ', 'Lat'], ['Kinh độ', 'Lng'], ['Độ cao (m)', 'Altitude']])], output: 'Number', colour: '#a37022' },
    { type: 'gps_has_fix', message0: 'GPS có vị trí hợp lệ', output: 'Boolean', colour: '#a37022' },
    { type: 'imu_value', message0: 'IMU · %1', args0: [dropdown('AXIS', [['Gia tốc X (g)', 'AccX'], ['Gia tốc Y (g)', 'AccY'], ['Gia tốc Z (g)', 'AccZ'], ['Gyro X (°/s)', 'GyroX'], ['Gyro Y (°/s)', 'GyroY'], ['Gyro Z (°/s)', 'GyroZ'], ['Từ trường X (µT)', 'MagX'], ['Từ trường Y (µT)', 'MagY'], ['Từ trường Z (µT)', 'MagZ']])], output: 'Number', colour: '#376b9c' },
  ];
  for (const [type, text, colour] of [
    ['eps_init', 'Khởi tạo nguồn EPS', '#71813e'],
    ['gps_init', 'Khởi tạo GPS', '#a37022'], ['com_init', 'Khởi tạo LoRa', '#a37022'],
    ['storage_init', 'Khởi tạo thẻ SD', '#8867a5'],
    ['cdh_init', 'Khởi tạo WiFi / MQTT', '#8867a5'], ['cdh_update', 'Xử lý WiFi / MQTT', '#8867a5'],
    ['sensor_update', 'Cập nhật cảm biến', '#376b9c'], ['eps_update', 'Cập nhật nguồn EPS', '#71813e'],
    ['imu_read_acc', 'Serial · in gia tốc XYZ (g)', '#376b9c'], ['imu_read_gyro', 'Serial · in gyro XYZ (°/s)', '#376b9c'],
    ['imu_read_mag', 'Serial · in từ trường XYZ (µT)', '#376b9c'],
  ]) blocks.push({ type, message0: text, ...statement, colour });
  for (const [type, text, colour] of [
    ['sensor_read_temp', 'Nhiệt độ (°C)', '#376b9c'], ['sensor_read_pressure', 'Áp suất (hPa)', '#376b9c'],
    ['eps_read_voltage', 'Điện áp pin (V)', '#71813e'], ['eps_read_percent', 'Dung lượng pin (%)', '#71813e'],
  ]) blocks.push({ type, message0: text, output: 'Number', colour });
  Blockly.common.defineBlocksWithJsonArray(blocks);
  // This editor has numeric variables; text can be composed using text_join.
  for (const type of ['variables_get', 'variables_set']) {
    const original = Blockly.Blocks[type].init;
    Blockly.Blocks[type].init = function () {
      original.call(this);
      if (type === 'variables_get') this.outputConnection.setCheck('Number');
      else this.getInput('VALUE').setCheck('Number');
    };
  }
}

const block = type => ({ kind: 'block', type });
const num = value => ({ shadow: { type: 'math_number', fields: { NUM: value } } });
const text = value => ({ shadow: { type: 'text', fields: { TEXT: value } } });
const category = (name, colour, contents) => ({ kind: 'category', name, colour, contents: contents.map(item => typeof item === 'string' ? block(item) : item) });

export function getToolboxForLab(labId) {
  /** @type {Blockly.utils.toolbox.ToolboxItemInfo[]} */
  const categories = [
    category('Chương trình', '#376b9c', ['arduino_setup', 'arduino_loop']),
    category('C++ tùy chỉnh', '#64748b', ['cpp_statement', 'cpp_expression', 'cpp_globals']),
    category('Arduino', '#267e77', ['pin_mode', 'digital_write', 'digital_read', 'analog_read', 'delay_ms', 'millis_value', 'serial_begin', { ...block('serial_print'), inputs: { VALUE: text('Hello CubeSat') } }]),
  ];
  if (labId >= 2) categories.push(category('Nguồn EPS', '#71813e', ['eps_init', 'eps_update', 'eps_read_voltage', 'eps_read_percent']));
  if (labId >= 3) categories.push(category('Lưu trữ SD', '#8867a5', ['storage_init', { ...block('storage_log'), inputs: { VALUE: text('Dữ liệu') } }]));
  if (labId >= 4) categories.push(
    category('Cảm biến', '#376b9c', ['sensor_init', 'sensor_update', 'sensor_read_temp', 'sensor_read_pressure', 'imu_value', 'imu_read_acc', 'imu_read_gyro', 'imu_read_mag']),
    category('GPS / Camera', '#a45e70', ['gps_init', 'gps_read', 'gps_has_fix', 'gps_value', 'camera_init', 'camera_capture']),
  );
  if (labId >= 5) categories.push(category('LoRa', '#a37022', ['com_init', { ...block('com_send'), inputs: { VALUE: text('Hello CubeSat') } }, 'com_receive']));
  if (labId >= 7) categories.push(category('WiFi / MQTT', '#8867a5', ['cdh_init', 'cdh_update']));
  categories.push(
    category('Telemetry', '#376b9c', ['telemetry_send']),
    { kind: 'sep' },
    category('Điều kiện', '#526eaa', ['controls_if', { ...block('logic_compare'), inputs: { A: num(0), B: num(0) } }, 'logic_operation', 'logic_negate', 'logic_boolean']),
    category('Vòng lặp', '#71813e', [{ ...block('controls_repeat_ext'), inputs: { TIMES: num(10) } }, 'controls_whileUntil', { ...block('controls_for'), inputs: { FROM: num(1), TO: num(10), BY: num(1) } }]),
    category('Toán học', '#7064a0', ['math_number', { ...block('math_arithmetic'), inputs: { A: num(1), B: num(1) } }, { ...block('math_modulo'), inputs: { DIVIDEND: num(10), DIVISOR: num(2) } }]),
    category('Văn bản', '#267e77', ['text', 'text_join', { ...block('text_print'), inputs: { TEXT: text('Hello CubeSat') } }]),
    { kind: 'category', name: 'Biến số', colour: '#a45e70', custom: 'VARIABLE' },
  );
  return { kind: 'categoryToolbox', contents: categories };
}

export function allowedBlockTypes(labId) {
  const types = new Set(['variables_get', 'variables_set', 'math_change']);
  for (const cat of getToolboxForLab(labId).contents) {
    if ('contents' in cat) for (const item of cat.contents) if ('type' in item) types.add(item.type);
  }
  return types;
}
