import { useRef, useEffect, useCallback } from 'react';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import 'blockly/javascript';
import { getToolboxForLab, registerCustomBlocks } from './blockly-toolbox';

// Register custom blocks once
let blocksRegistered = false;

export default function BlocklyEditor({ labId = 1, onCodeChange, minHeight = '400px' }) {
  const containerRef = useRef(null);
  const workspaceRef = useRef(null);

  const handleWorkspaceChange = useCallback(() => {
    if (!workspaceRef.current) return;
    try {
      // Generate Arduino/C++ code from blocks
      let code = '';
      const allBlocks = workspaceRef.current.getAllBlocks(true);

      // Build includes
      const includes = new Set(['#include <Arduino.h>', '#include "PTITCube.h"']);
      const setupLines = [];

      allBlocks.forEach(block => {
        const gen = block.type;
        if (gen.startsWith('sensor_') || gen.startsWith('imu_')) includes.add('// Sensor enabled');
        if (gen.startsWith('gps_')) includes.add('// GPS enabled');
        if (gen.startsWith('lora_') || gen.startsWith('com_')) includes.add('// COM enabled');
      });

      // Simple code generation
      code = [...includes].join('\n') + '\n\n';
      code += '// === Khai báo đối tượng ===\n';
      code += 'PTIT_Sensor sensor;\nPTIT_GPS gps;\nPTIT_COM lora;\nPTIT_EPS eps;\nPTIT_Storage storage;\nPTIT_CDH cdh;\n\n';
      code += 'void setup() {\n';
      code += '    Serial.begin(115200);\n';
      code += '    // TODO: Thêm code khởi tạo từ Blockly\n';

      // Generate setup code from blocks
      allBlocks.forEach(block => {
        if (block.type === 'sensor_init') setupLines.push('    sensor.init();');
        if (block.type === 'gps_init') setupLines.push('    gps.init();');
        if (block.type === 'eps_init') setupLines.push('    eps.init();');
        if (block.type === 'com_init') setupLines.push('    lora.init();');
        if (block.type === 'storage_init') setupLines.push('    storage.init();');
        if (block.type === 'cdh_init') setupLines.push('    cdh.init();');
      });
      code += setupLines.join('\n') + '\n';
      code += '}\n\n';

      code += 'void loop() {\n';
      // Generate loop code from blocks
      allBlocks.forEach(block => {
        switch (block.type) {
          case 'serial_print':
            code += `    Serial.println(${block.getFieldValue('TEXT') ? '"' + block.getFieldValue('TEXT') + '"' : '""'});\n`;
            break;
          case 'digital_write':
            code += `    digitalWrite(${block.getFieldValue('PIN') || '2'}, ${block.getFieldValue('STATE') || 'HIGH'});\n`;
            break;
          case 'delay_ms':
            code += `    delay(${block.getFieldValue('MS') || '1000'});\n`;
            break;
          case 'sensor_read_temp':
            code += '    float temp = sensor.getTemperature();\n';
            code += '    Serial.print("Temp: "); Serial.println(temp);\n';
            break;
          case 'sensor_read_pressure':
            code += '    float pressure = sensor.getPressure();\n';
            code += '    Serial.print("Pressure: "); Serial.println(pressure);\n';
            break;
          case 'eps_read_voltage':
            code += '    float voltage = eps.getBatteryVoltage();\n';
            code += '    Serial.print("Battery: "); Serial.println(voltage);\n';
            break;
          case 'gps_read':
            code += '    gps.update();\n';
            code += '    Serial.print("GPS: "); Serial.print(gps.getLat(), 6);\n';
            code += '    Serial.print(", "); Serial.println(gps.getLng(), 6);\n';
            break;
          case 'imu_read_acc':
            code += '    sensor.update();\n';
            code += '    Serial.printf("Acc: X=%.2f Y=%.2f Z=%.2f\\n", sensor.getAccX(), sensor.getAccY(), sensor.getAccZ());\n';
            break;
          case 'com_send':
            code += `    lora.sendMessage(${block.getFieldValue('MSG') ? '"' + block.getFieldValue('MSG') + '"' : '""'});\n`;
            break;
          case 'storage_log':
            code += `    storage.logData(${block.getFieldValue('DATA') ? '"' + block.getFieldValue('DATA') + '"' : '""'});\n`;
            break;
        }
      });

      code += '    delay(1000);\n';
      code += '}\n';

      if (onCodeChange) onCodeChange(code);
    } catch (err) {
      console.error('Code generation error:', err);
    }
  }, [onCodeChange]);

  useEffect(() => {
    if (!containerRef.current || workspaceRef.current) return;

    if (!blocksRegistered) {
      registerCustomBlocks();
      blocksRegistered = true;
    }

    const toolbox = getToolboxForLab(labId);

    workspaceRef.current = Blockly.inject(containerRef.current, {
      toolbox,
      theme: Blockly.Themes.Classic,
      grid: { spacing: 20, length: 3, colour: '#1a1f2e', snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 3, minScale: 0.3 },
      trashcan: true,
      move: { scrollbars: true, drag: true },
      renderer: 'zelos',
    });

    workspaceRef.current.addChangeListener(handleWorkspaceChange);

    return () => {
      if (workspaceRef.current) {
        workspaceRef.current.dispose();
        workspaceRef.current = null;
      }
    };
  }, [labId, handleWorkspaceChange]);

  return (
    <div ref={containerRef} className="blockly-container" style={{ width: '100%', height: '100%', minHeight }} />
  );
}
