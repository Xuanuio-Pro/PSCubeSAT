// Export reproducible C++ fixtures for the existing isolated compiler service.
// This script never flashes a device. Run: node scripts/blockly-smoke.mjs
import * as Blockly from 'blockly';
import { mkdirSync, writeFileSync } from 'node:fs';
import { registerCustomBlocks, allowedBlockTypes } from '../src/components/editor/blockly-toolbox.js';
import { starterWorkspace } from '../src/components/editor/blockly-project.js';
import { generateArduino } from '../src/components/editor/arduino-generator.js';

registerCustomBlocks();
mkdirSync('scratch/blockly-smoke', { recursive: true });
function save(workspace, name, lab) {
  const result = generateArduino(workspace, lab);
  if (result.issues.length) throw new Error(JSON.stringify(result.issues));
  writeFileSync(`scratch/blockly-smoke/${name}.cpp`, result.code);
}
for (let lab = 1; lab <= 8; lab++) {
  const workspace = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(starterWorkspace(lab), workspace);
  save(workspace, `lab${lab}`, lab);
  workspace.dispose();
}
const workspace = new Blockly.Workspace();
Blockly.serialization.workspaces.load(starterWorkspace(8, true), workspace);
let setupConnection = workspace.getBlocksByType('arduino_setup')[0].getInput('DO').connection;
let loopConnection = workspace.getBlocksByType('arduino_loop')[0].getInput('DO').connection;
for (const type of allowedBlockTypes(8)) {
  if (type.startsWith('arduino_')) continue;
  const block = workspace.newBlock(type);
  for (const entry of block.inputList) if (entry.type === Blockly.inputs.inputTypes.VALUE) {
    const check = entry.connection.getCheck();
    const child = workspace.newBlock(check?.includes('Boolean') ? 'logic_boolean' : 'math_number');
    if (child.type === 'math_number') child.setFieldValue(1, 'NUM');
    entry.connection.connect(child.outputConnection);
  }
  let statement = block;
  if (block.outputConnection) {
    statement = workspace.newBlock('serial_print');
    statement.getInput('VALUE').connection.connect(block.outputConnection);
  }
  if (type.endsWith('_init')) { setupConnection.connect(statement.previousConnection); setupConnection = statement.nextConnection; }
  else { loopConnection.connect(statement.previousConnection); loopConnection = statement.nextConnection; }
}
save(workspace, 'all-blocks', 8);
workspace.dispose();
console.log('Exported 8 lab starters and all-blocks.cpp to scratch/blockly-smoke.');
