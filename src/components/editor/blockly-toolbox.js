import * as Blockly from 'blockly';

/**
 * Register all custom PTITCube blocks for Blockly.
 * Maps 1:1 with the PTITCube firmware library API.
 */
export function registerCustomBlocks() {
  // === Arduino Core ===
  Blockly.Blocks['serial_print'] = {
    init() {
      this.appendDummyInput().appendField('Serial.println(').appendField(new Blockly.FieldTextInput('Hello CubeSat'), 'TEXT').appendField(')');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip('In một dòng văn bản ra Serial Monitor');
    }
  };

  Blockly.Blocks['digital_write'] = {
    init() {
      this.appendDummyInput()
        .appendField('digitalWrite(Pin')
        .appendField(new Blockly.FieldNumber(2, 0, 39), 'PIN')
        .appendField(',')
        .appendField(new Blockly.FieldDropdown([['HIGH', 'HIGH'], ['LOW', 'LOW']]), 'STATE')
        .appendField(')');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip('Bật/tắt một chân Digital (LED)');
    }
  };

  Blockly.Blocks['digital_read'] = {
    init() {
      this.appendDummyInput()
        .appendField('digitalRead(Pin')
        .appendField(new Blockly.FieldNumber(4, 0, 39), 'PIN')
        .appendField(')');
      this.setOutput(true, 'Number');
      this.setColour(160);
      this.setTooltip('Đọc trạng thái chân Digital (HIGH/LOW)');
    }
  };

  Blockly.Blocks['analog_read'] = {
    init() {
      this.appendDummyInput()
        .appendField('analogRead(Pin')
        .appendField(new Blockly.FieldNumber(34, 0, 39), 'PIN')
        .appendField(')');
      this.setOutput(true, 'Number');
      this.setColour(160);
      this.setTooltip('Đọc giá trị ADC (0-4095) từ chân Analog');
    }
  };

  Blockly.Blocks['delay_ms'] = {
    init() {
      this.appendDummyInput().appendField('delay(').appendField(new Blockly.FieldNumber(1000, 0), 'MS').appendField('ms)');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip('Tạm dừng chương trình (mili-giây)');
    }
  };

  Blockly.Blocks['pin_mode'] = {
    init() {
      this.appendDummyInput()
        .appendField('pinMode(Pin')
        .appendField(new Blockly.FieldNumber(2, 0, 39), 'PIN')
        .appendField(',')
        .appendField(new Blockly.FieldDropdown([['OUTPUT', 'OUTPUT'], ['INPUT', 'INPUT'], ['INPUT_PULLUP', 'INPUT_PULLUP']]), 'MODE')
        .appendField(')');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip('Cài đặt chế độ cho chân I/O');
    }
  };

  // === PTIT_Sensor ===
  Blockly.Blocks['sensor_init'] = {
    init() {
      this.appendDummyInput().appendField('🔬 sensor.init()');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(210);
      this.setTooltip('Khởi tạo hệ thống cảm biến (BMP280 + MPU6050 + QMC5883L)');
    }
  };

  Blockly.Blocks['sensor_read_temp'] = {
    init() {
      this.appendDummyInput().appendField('🌡️ sensor.getTemperature()');
      this.setOutput(true, 'Number');
      this.setColour(210);
      this.setTooltip('Đọc nhiệt độ (°C) từ BMP280');
    }
  };

  Blockly.Blocks['sensor_read_pressure'] = {
    init() {
      this.appendDummyInput().appendField('🌡️ sensor.getPressure()');
      this.setOutput(true, 'Number');
      this.setColour(210);
      this.setTooltip('Đọc áp suất (hPa) từ BMP280');
    }
  };

  Blockly.Blocks['imu_read_acc'] = {
    init() {
      this.appendDummyInput().appendField('📐 Đọc Gia tốc (Acc X/Y/Z)');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(210);
      this.setTooltip('Đọc và in gia tốc 3 trục từ MPU6050');
    }
  };

  Blockly.Blocks['imu_read_gyro'] = {
    init() {
      this.appendDummyInput().appendField('🔄 Đọc Gyro (X/Y/Z)');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(210);
      this.setTooltip('Đọc và in gyroscope 3 trục từ MPU6050');
    }
  };

  Blockly.Blocks['imu_read_mag'] = {
    init() {
      this.appendDummyInput().appendField('🧭 Đọc Từ trường (Mag X/Y/Z)');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(210);
      this.setTooltip('Đọc la bàn từ trường 3 trục từ QMC5883L');
    }
  };

  // === PTIT_EPS ===
  Blockly.Blocks['eps_init'] = {
    init() {
      this.appendDummyInput().appendField('🔋 eps.init()');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(120);
      this.setTooltip('Khởi tạo hệ thống quản lý năng lượng');
    }
  };

  Blockly.Blocks['eps_read_voltage'] = {
    init() {
      this.appendDummyInput().appendField('🔋 eps.getBatteryVoltage()');
      this.setOutput(true, 'Number');
      this.setColour(120);
      this.setTooltip('Đọc điện áp pin (V) qua ADC');
    }
  };

  // === PTIT_GPS ===
  Blockly.Blocks['gps_init'] = {
    init() {
      this.appendDummyInput().appendField('🌍 gps.init()');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(30);
      this.setTooltip('Khởi tạo module GPS NEO');
    }
  };

  Blockly.Blocks['gps_read'] = {
    init() {
      this.appendDummyInput().appendField('🌍 Đọc GPS (Lat/Lng)');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(30);
      this.setTooltip('Cập nhật và in tọa độ GPS');
    }
  };

  // === PTIT_Storage ===
  Blockly.Blocks['storage_init'] = {
    init() {
      this.appendDummyInput().appendField('💾 storage.init()');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(290);
      this.setTooltip('Khởi tạo thẻ nhớ MicroSD');
    }
  };

  Blockly.Blocks['storage_log'] = {
    init() {
      this.appendDummyInput()
        .appendField('💾 storage.logData(')
        .appendField(new Blockly.FieldTextInput('data'), 'DATA')
        .appendField(')');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(290);
      this.setTooltip('Ghi một dòng dữ liệu vào file log trên thẻ nhớ');
    }
  };

  // === PTIT_COM ===
  Blockly.Blocks['com_init'] = {
    init() {
      this.appendDummyInput().appendField('📡 lora.init()');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(60);
      this.setTooltip('Khởi tạo module LoRa E32');
    }
  };

  Blockly.Blocks['com_send'] = {
    init() {
      this.appendDummyInput()
        .appendField('📡 lora.sendMessage(')
        .appendField(new Blockly.FieldTextInput('Hello'), 'MSG')
        .appendField(')');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(60);
      this.setTooltip('Gửi một tin nhắn qua LoRa');
    }
  };

  // === PTIT_CDH ===
  Blockly.Blocks['cdh_init'] = {
    init() {
      this.appendDummyInput().appendField('🧠 cdh.init()');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(330);
      this.setTooltip('Khởi tạo WiFi + MQTT');
    }
  };

  // === Camera ===
  Blockly.Blocks['camera_capture'] = {
    init() {
      this.appendDummyInput().appendField('📷 camera.capture()');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(0);
      this.setTooltip('Chụp ảnh và gửi qua Serial');
    }
  };
}

/**
 * Get the Blockly toolbox configuration for a given lab level.
 * Each lab progressively unlocks more block categories.
 */
export function getToolboxForLab(labId) {
  const categories = [];

  // Lab 1+: Arduino Core
  if (labId >= 1) {
    categories.push({
      kind: 'category',
      name: '🔧 Cơ bản (Arduino)',
      colour: 160,
      contents: [
        { kind: 'block', type: 'pin_mode' },
        { kind: 'block', type: 'digital_write' },
        { kind: 'block', type: 'digital_read' },
        { kind: 'block', type: 'delay_ms' },
        { kind: 'block', type: 'serial_print' },
      ],
    });
  }

  // Lab 2+: EPS
  if (labId >= 2) {
    categories.push({
      kind: 'category',
      name: '🔋 Năng lượng (EPS)',
      colour: 120,
      contents: [
        { kind: 'block', type: 'eps_init' },
        { kind: 'block', type: 'eps_read_voltage' },
        { kind: 'block', type: 'digital_read' },
      ],
    });
  }

  // Lab 3+: ADC + Storage
  if (labId >= 3) {
    categories.push({
      kind: 'category',
      name: '💾 Lưu trữ và ADC',
      colour: 290,
      contents: [
        { kind: 'block', type: 'storage_init' },
        { kind: 'block', type: 'storage_log' },
        { kind: 'block', type: 'analog_read' },
      ],
    });
  }

  // Lab 4+: Sensors + GPS + Camera
  if (labId >= 4) {
    categories.push(
      {
        kind: 'category',
        name: '🔬 Cảm biến',
        colour: 210,
        contents: [
          { kind: 'block', type: 'sensor_init' },
          { kind: 'block', type: 'sensor_read_temp' },
          { kind: 'block', type: 'sensor_read_pressure' },
          { kind: 'block', type: 'imu_read_acc' },
          { kind: 'block', type: 'imu_read_gyro' },
          { kind: 'block', type: 'imu_read_mag' },
        ],
      },
      {
        kind: 'category',
        name: '🌍 GPS',
        colour: 30,
        contents: [
          { kind: 'block', type: 'gps_init' },
          { kind: 'block', type: 'gps_read' },
        ],
      },
      {
        kind: 'category',
        name: '📷 Camera',
        colour: 0,
        contents: [
          { kind: 'block', type: 'camera_capture' },
        ],
      }
    );
  }

  // Lab 5+: COM
  if (labId >= 5) {
    categories.push({
      kind: 'category',
      name: '📡 Viễn thông (COM)',
      colour: 60,
      contents: [
        { kind: 'block', type: 'com_init' },
        { kind: 'block', type: 'com_send' },
      ],
    });
  }

  // Lab 7+: CDH + Full
  if (labId >= 7) {
    categories.push({
      kind: 'category',
      name: '🧠 CDH (WiFi/MQTT)',
      colour: 330,
      contents: [
        { kind: 'block', type: 'cdh_init' },
      ],
    });
  }

  // Always include built-in logic/loops for Lab 1+
  if (labId >= 1) {
    categories.push(
      { kind: 'sep' },
      {
        kind: 'category',
        name: '🔀 Logic',
        colour: 210,
        contents: [
          { kind: 'block', type: 'controls_if' },
          { kind: 'block', type: 'logic_compare' },
          { kind: 'block', type: 'logic_operation' },
          { kind: 'block', type: 'logic_boolean' },
        ],
      },
      {
        kind: 'category',
        name: '🔁 Vòng lặp',
        colour: 120,
        contents: [
          { kind: 'block', type: 'controls_repeat_ext' },
          { kind: 'block', type: 'controls_whileUntil' },
          { kind: 'block', type: 'controls_for' },
        ],
      },
      {
        kind: 'category',
        name: '🔢 Toán học',
        colour: 230,
        contents: [
          { kind: 'block', type: 'math_number' },
          { kind: 'block', type: 'math_arithmetic' },
        ],
      },
      {
        kind: 'category',
        name: '📝 Văn bản',
        colour: 160,
        contents: [
          { kind: 'block', type: 'text' },
          { kind: 'block', type: 'text_join' },
          { kind: 'block', type: 'text_print' },
        ],
      }
    );
  }

  return { kind: 'categoryToolbox', contents: categories };
}
