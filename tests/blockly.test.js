import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly';
import { registerCustomBlocks, allowedBlockTypes } from '../src/components/editor/blockly-toolbox.js';
import { generateArduino, arduinoGenerator, cppString } from '../src/components/editor/arduino-generator.js';
import { starterWorkspace, encodeProject, decodeProject } from '../src/components/editor/blockly-project.js';
import { adaptSerialLine } from '../src/telemetry/adapters.js';

registerCustomBlocks();
const n = number => ({ type: 'math_number', fields: { NUM: number } });
const t = text => ({ type: 'text', fields: { TEXT: text } });
const input = block => ({ block });
const print = block => ({ type: 'serial_print', inputs: { VALUE: input(block) } });
function workspace(t, loop = null, setup = null) {
  const ws = new Blockly.Workspace();
  t.after(() => ws.dispose());
  const state = starterWorkspace(8, true);
  if (loop) state.blocks.blocks[1].inputs = { DO: input(loop) };
  if (setup) state.blocks.blocks[0].inputs = { DO: input(setup) };
  Blockly.serialization.workspaces.load(state, ws);
  return ws;
}
function generated(ws, lab = 8) {
  const result = generateArduino(ws, lab);
  assert.deepEqual(result.issues, []);
  return result.code;
}

test('all eight lab starters generate separate setup/loop and round-trip exactly', ctx => {
  for (let lab = 1; lab <= 8; lab++) {
    const ws = workspace(ctx);
    Blockly.serialization.workspaces.load(starterWorkspace(lab), ws);
    const code = generated(ws, lab);
    assert.equal((code.match(/void setup\(/g) || []).length, 1);
    assert.equal((code.match(/void loop\(/g) || []).length, 1);
    assert.doesNotMatch(code, /TODO|undefined/);
    const copy = workspace(ctx);
    Blockly.serialization.workspaces.load(decodeProject(encodeProject(ws, lab), lab), copy);
    assert.equal(generated(copy, lab), code);
  }
});

test('nested if / else and repeats preserve connectivity and statement order', ctx => {
  const ws = workspace(ctx, { type: 'controls_if', extraState: { hasElse: true }, inputs: {
    IF0: input({ type: 'logic_compare', fields: { OP: 'GT' }, inputs: { A: input({ type: 'eps_read_voltage' }), B: input(n(3.7)) } }),
    DO0: input({ type: 'controls_repeat_ext', inputs: { TIMES: input(n(3)), DO: input(print(t('inside'))) } }),
    ELSE: input(print(t('otherwise'))),
  }, next: input(print(t('after'))) });
  const code = generated(ws);
  assert.match(code, /if \(\(eps.getBatteryVoltage\(\) > 3.7\)\) \{/);
  assert.match(code, /for \(double cube_i_0[\s\S]*Serial.println\(String\("inside"\)\);[\s\S]*else \{[\s\S]*"otherwise"[\s\S]*"after"/);
  assert.equal((code.match(/"inside"/g) || []).length, 1);
  assert.equal((code.match(/eps.init\(\)/g) || []).length, 1);
});

test('expressions preserve precedence, floating division and string escaping', ctx => {
  const ws = workspace(ctx, print({ type: 'math_arithmetic', fields: { OP: 'MULTIPLY' }, inputs: {
    A: input({ type: 'math_arithmetic', fields: { OP: 'ADD' }, inputs: { A: input(n(1)), B: input(n(2)) } }),
    B: input({ type: 'math_arithmetic', fields: { OP: 'DIVIDE' }, inputs: { A: input(n(1)), B: input(n(2)) } }),
  } }));
  assert.match(generated(ws), /\(\(1 \+ 2\) \* \(\(double\)\(1\) \/ 2\)\)/);
  assert.equal(cppString('a"\\\n\0b'), '"a\\"\\\\\\012\\000b"');
  assert.equal(cppString('Vệ tinh'), '"Vệ tinh"');
});

test('detached, incomplete, duplicate and unavailable blocks block compilation', ctx => {
  const ws = workspace(ctx);
  const orphan = ws.newBlock('serial_print');
  let result = generateArduino(ws, 1);
  assert.equal(result.code, '');
  assert.ok(result.issues.some(i => i.blockId === orphan.id && i.message.includes('Block rời')));
  assert.ok(result.issues.some(i => i.message.includes('Thiếu giá trị')));
  orphan.dispose();
  ws.newBlock('arduino_setup');
  ws.newBlock('com_send');
  result = generateArduino(ws, 1);
  assert.equal(result.code, '');
  assert.ok(result.issues.some(i => i.message.includes('đúng một')));
  assert.ok(result.issues.some(i => i.message.includes('chưa được hỗ trợ')));
});

test('disabled stacks do not execute or declare unused hardware', ctx => {
  const ws = workspace(ctx, { type: 'controls_repeat_ext', inputs: { TIMES: input(n(2)), DO: input(print({ type: 'eps_read_voltage' })) } });
  ws.getBlocksByType('controls_repeat_ext')[0].setDisabledReason(true, 'test');
  const code = generated(ws);
  assert.doesNotMatch(code, /PTIT_EPS|eps\.|for \(/);
});

test('initializers execute only once in setup, never silently hoisted out of a loop', ctx => {
  const ws = workspace(ctx, print({ type: 'eps_read_voltage' }), { type: 'eps_init' });
  const code = generated(ws);
  assert.equal((code.match(/eps.init\(\)/g) || []).length, 1);
  assert.match(code, /void loop\(\) \{\n  eps.update\(\);/);
  Blockly.serialization.workspaces.load(starterWorkspace(8, true), ws);
  const init = ws.newBlock('eps_init');
  ws.getBlocksByType('arduino_loop')[0].getInput('DO').connection.connect(init.previousConnection);
  assert.ok(generateArduino(ws).issues.some(i => i.message.includes('trực tiếp')));
});

test('numeric variables use safe names and descending loops evaluate bounds once', ctx => {
  const ws = workspace(ctx);
  const variable = ws.getVariableMap().createVariable('class " x');
  const loop = ws.newBlock('controls_for');
  loop.setFieldValue(variable.getId(), 'VAR');
  for (const [name, val] of [['FROM', 10], ['TO', 1], ['BY', 2]]) {
    const child = ws.newBlock('math_number'); child.setFieldValue(val, 'NUM');
    loop.getInput(name).connection.connect(child.outputConnection);
  }
  ws.getBlocksByType('arduino_loop')[0].getInput('DO').connection.connect(loop.previousConnection);
  const code = generated(ws);
  assert.match(code, /double cube_var_0 = 0;/);
  assert.match(code, /cube_up_0 \? cube_step_0 : -cube_step_0/);
  assert.doesNotMatch(code, /class "/);
  loop.getInputTargetBlock('BY').setFieldValue(0, 'NUM');
  assert.equal(generateArduino(ws).code, '');
});

test('every toolbox block has a generator and produces code with required inputs', ctx => {
  for (const type of allowedBlockTypes(8)) {
    assert.equal(typeof arduinoGenerator.forBlock[type], 'function', type);
    if (type.startsWith('arduino_')) continue;
    const ws = workspace(ctx);
    const block = ws.newBlock(type);
    for (const entry of block.inputList) if (entry.type === Blockly.inputs.inputTypes.VALUE) {
      const check = entry.connection.getCheck();
      const child = ws.newBlock(check?.includes('Boolean') ? 'logic_boolean' : 'math_number');
      if (child.type === 'math_number') child.setFieldValue(1, 'NUM');
      entry.connection.connect(child.outputConnection);
    }
    const root = ws.getBlocksByType(type.endsWith('_init') ? 'arduino_setup' : 'arduino_loop')[0];
    if (block.outputConnection) {
      const printer = ws.newBlock('serial_print');
      printer.getInput('VALUE').connection.connect(block.outputConnection);
      root.getInput('DO').connection.connect(printer.previousConnection);
    } else root.getInput('DO').connection.connect(block.previousConnection);
    assert.doesNotMatch(generated(ws), /undefined/, type);
  }
});

test('telemetry uses contract units, nulls and a validated device UID', ctx => {
  const ws = workspace(ctx, { type: 'telemetry_send', fields: { DEVICE: 'test-device' } }, { type: 'sensor_init', next: input({ type: 'eps_init', next: input({ type: 'gps_init' }) }) });
  const code = generated(ws);
  assert.match(code, /sensor.getAccX\(\) \/ 9.80665/);
  assert.match(code, /sensor.getGyroX\(\) \* 57.2957795131/);
  assert.match(code, /gps.hasFix\(\) \? gps.getLat\(\) : NAN/);
  assert.match(code, /else Serial.print\("null"\)/);
  // Reconstruct a minimal emitted packet and send it through the actual Serial adapter.
  const packet = JSON.stringify({ type: 'telemetry', schema_version: 1, device_id: 'test-device', source: 'hardware', uptimeMs: 0, accX: 1, voltageV: 0, temperatureC: null });
  assert.equal(adaptSerialLine(packet, 'test-device', 1000)?.device_id, 'test-device');
  ws.getBlocksByType('telemetry_send')[0].setFieldValue('bad/device', 'DEVICE');
  assert.equal(generateArduino(ws).code, '');
});

test('import rejects other labs, unknown blocks, malformed files and huge input', ctx => {
  const ws = workspace(ctx);
  const original = encodeProject(ws, 8);
  assert.throws(() => decodeProject(original, 1), /Lab 8/);
  assert.throws(() => decodeProject('{}', 8), /định dạng/);
  assert.throws(() => decodeProject('x'.repeat(1000001), 8), /1 MB/);
  assert.throws(() => decodeProject(original.replace('arduino_loop', 'not_a_block'), 8), /không được hỗ trợ/);
  assert.equal(encodeProject(ws, 8), original);
});

test('long valid statement chains survive export/import, oversized block counts are rejected', ctx => {
  const ws = workspace(ctx);
  let connection = ws.getBlocksByType('arduino_loop')[0].getInput('DO').connection;
  for (let i = 0; i < 120; i++) {
    const delay = ws.newBlock('delay_ms');
    connection.connect(delay.previousConnection);
    connection = delay.nextConnection;
  }
  const copy = workspace(ctx);
  Blockly.serialization.workspaces.load(decodeProject(encodeProject(ws, 8), 8), copy);
  assert.equal(generated(copy), generated(ws));
  const tooMany = { format: 'ptit-blockly', version: 1, labId: 8, workspace: { blocks: { languageVersion: 0, blocks: Array.from({ length: 501 }, () => ({ type: 'delay_ms' })) } } };
  assert.throws(() => decodeProject(JSON.stringify(tooMany), 8), /500 block/);
});

test('Lab4 can isolate environment/IMU and camera selects MUX without overwriting photos', ctx => {
  for (const [mode, args] of [['ENV', 'true, false, false'], ['IMU', 'false, true, true']]) {
    const ws = workspace(ctx, print({ type: 'sensor_read_temp' }), { type: 'sensor_init', fields: { SENSORS: mode } });
    assert.ok(generated(ws).includes(`sensor.init(${args});`));
  }
  const ws = workspace(ctx, { type: 'camera_capture' }, { type: 'camera_init' });
  let code = generated(ws);
  assert.match(code, /camera.init\(12, 14\);/);
  assert.match(code, /SD.exists\(cube_image_path.c_str\(\)\)/);
  assert.match(code, /camera.captureToFile\(cube_image_path.c_str\(\)\)/);
  assert.doesNotMatch(code, /camera.capture\(\)|PTIT_GPS|gps.init/);
  ws.getBlocksByType('camera_init')[0].setFieldValue('DIRECT', 'CONNECTION');
  code = generated(ws);
  assert.match(code, /camera.init\(255, 255\);/);
  const implicit = workspace(ctx, { type: 'camera_capture' });
  assert.match(generated(implicit), /camera.init\(12, 14\);/);
});

test('every lab toolbox survives connection, export/import and repeated generation', ctx => {
  for (let lab = 1; lab <= 8; lab++) {
    const ws = workspace(ctx);
    let setup = ws.getBlocksByType('arduino_setup')[0].getInput('DO').connection;
    let loop = ws.getBlocksByType('arduino_loop')[0].getInput('DO').connection;
    for (const type of allowedBlockTypes(lab)) {
      if (type.startsWith('arduino_')) continue;
      const block = ws.newBlock(type);
      for (const entry of block.inputList) if (entry.type === Blockly.inputs.inputTypes.VALUE) {
        const child = ws.newBlock(entry.connection.getCheck()?.includes('Boolean') ? 'logic_boolean' : 'math_number');
        if (child.type === 'math_number') child.setFieldValue(1, 'NUM');
        entry.connection.connect(child.outputConnection);
      }
      let statement = block;
      if (block.outputConnection) {
        statement = ws.newBlock('serial_print');
        statement.getInput('VALUE').connection.connect(block.outputConnection);
      }
      if (type.endsWith('_init')) { setup.connect(statement.previousConnection); setup = statement.nextConnection; }
      else { loop.connect(statement.previousConnection); loop = statement.nextConnection; }
    }
    const code = generated(ws, lab);
    const copy = workspace(ctx);
    Blockly.serialization.workspaces.load(decodeProject(encodeProject(ws, lab), lab), copy);
    for (let repeat = 0; repeat < 5; repeat++) assert.equal(generated(copy, lab), code, `Lab ${lab}`);
    // Switching the shared generator back to an earlier lab must not retain hardware or variables.
    const minimal = workspace(ctx);
    assert.doesNotMatch(generated(minimal, 1), /PTITCube|cube_var_|sensor\.|gps\.|lora\.|camera\./);
    assert.equal(generated(ws, lab), code);
  }
});

test('disconnect/reconnect never compiles an orphan or duplicates statements', ctx => {
  const ws = workspace(ctx, print(t('unique marker')));
  const original = generated(ws);
  const block = ws.getBlocksByType('serial_print')[0];
  for (let repeat = 0; repeat < 20; repeat++) {
    block.unplug();
    assert.equal(generateArduino(ws).code, '');
    ws.getBlocksByType('arduino_loop')[0].getInput('DO').connection.connect(block.previousConnection);
    assert.equal(generated(ws), original);
  }
});
