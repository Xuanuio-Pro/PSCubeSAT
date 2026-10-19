// Generate real Blockly projects and their C++ for hardware testing, without GPS.
// Run: node scripts/blockly-lab4-fixtures.mjs
import * as Blockly from 'blockly';
import { mkdirSync, writeFileSync } from 'node:fs';
import { registerCustomBlocks } from '../src/components/editor/blockly-toolbox.js';
import { starterWorkspace, encodeProject } from '../src/components/editor/blockly-project.js';
import { generateArduino } from '../src/components/editor/arduino-generator.js';

registerCustomBlocks();
const folder = 'scratch/lab4-blockly-hardware';
mkdirSync(folder, { recursive: true });
const chain = items => items.reduceRight((next, item) => ({ ...item, ...(next ? { next: { block: next } } : {}) }), null);
const print = text => ({ type: 'serial_print', inputs: { VALUE: { block: { type: 'text', fields: { TEXT: text } } } } });
const reading = type => ({ type: 'serial_print', inputs: { VALUE: { block: { type } } } });
const fixtures = [
  { name: 'environment', setup: [{ type: 'sensor_init', fields: { SENSORS: 'ENV' } }], loop: [print('[ENV] temperatureC / pressureHpa'), reading('sensor_read_temp'), reading('sensor_read_pressure')], delay: 1000 },
  { name: 'imu', setup: [{ type: 'sensor_init', fields: { SENSORS: 'IMU' } }], loop: [{ type: 'imu_read_acc' }, { type: 'imu_read_gyro' }, { type: 'imu_read_mag' }], delay: 200 },
  // One capture in setup avoids filling the SD card during unattended operation.
  { name: 'camera', setup: [{ type: 'camera_init', fields: { CONNECTION: 'MUX' } }, { type: 'camera_capture' }, print('[CAMERA] capture attempt finished')], loop: [], delay: 1000 },
  { name: 'all-sensors', setup: [{ type: 'sensor_init', fields: { SENSORS: 'ALL' } }], loop: [], delay: 200 },
];
for (const fixture of fixtures) {
  const workspace = new Blockly.Workspace();
  const state = starterWorkspace(4, true);
  state.blocks.blocks[0].inputs = { DO: { block: chain([{ type: 'delay_ms', fields: { MS: 2000 } }, print(`[BLOCKLY_TEST] ${fixture.name}`), ...fixture.setup]) } };
  state.blocks.blocks[1].inputs = { DO: { block: chain([...fixture.loop, { type: 'telemetry_send', fields: { DEVICE: `lab4-${fixture.name}` } }, { type: 'delay_ms', fields: { MS: fixture.delay } }]) } };
  Blockly.serialization.workspaces.load(state, workspace);
  const result = generateArduino(workspace, 4);
  if (result.issues.length) throw new Error(JSON.stringify(result.issues));
  if (/PTIT_GPS|gps\.(init|update|selectGPS)/.test(result.code)) throw new Error('GPS must not be used by these fixtures.');
  writeFileSync(`${folder}/${fixture.name}.json`, encodeProject(workspace, 4));
  writeFileSync(`${folder}/${fixture.name}.cpp`, result.code);
  workspace.dispose();
}
console.log(`Exported ${fixtures.length} Blockly/C++ fixtures (no GPS) to ${folder}`);
