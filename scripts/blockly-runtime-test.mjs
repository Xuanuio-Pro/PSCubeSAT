// Execute generated control-flow C++ on the host. Hardware is deliberately absent.
// Requires g++ on PATH. The ESP32 build matrix separately validates Arduino APIs.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import * as Blockly from 'blockly';
import { registerCustomBlocks } from '../src/components/editor/blockly-toolbox.js';
import { starterWorkspace } from '../src/components/editor/blockly-project.js';
import { generateArduino } from '../src/components/editor/arduino-generator.js';
import { cppToWorkspace } from '../src/components/editor/cpp-to-blockly.js';

registerCustomBlocks();
const input = block => ({ block });
const n = NUM => ({ type: 'math_number', fields: { NUM } });
const text = TEXT => ({ type: 'text', fields: { TEXT } });
const print = value => ({ type: 'serial_print', inputs: { VALUE: input(value) } });
const binary = (type, OP, A, B) => ({ type, fields: { OP }, inputs: { A: input(A), B: input(B) } });
const arithmetic = (op, a, b) => binary('math_arithmetic', op, a, b);
const compare = (op, a, b) => binary('logic_compare', op, a, b);
const chain = blocks => blocks.reduceRight((next, block) => ({ ...block, ...(next ? { next: input(next) } : {}) }), null);
const variable = { id: 'counter', name: 'class unsafe name' };
const get = () => ({ type: 'variables_get', fields: { VAR: variable } });
const set = value => ({ type: 'variables_set', fields: { VAR: variable }, inputs: { VALUE: input(n(value)) } });
const decrement = () => ({ type: 'math_change', fields: { VAR: variable }, inputs: { DELTA: input(n(-1)) } });
const state = starterWorkspace(1, true);
state.variables = [variable];
state.blocks.blocks[0].inputs = { DO: input(print(text('setup once'))) };
state.blocks.blocks[1].inputs = { DO: input(chain([
  print(arithmetic('MULTIPLY', arithmetic('ADD', n(1), n(2)), arithmetic('DIVIDE', n(1), n(2)))),
  print(arithmetic('POWER', n(2), n(3))),
  { type: 'controls_for', fields: { VAR: variable }, inputs: { FROM: input(n(3)), TO: input(n(1)), BY: input(n(1)), DO: input(print(get())) } },
  { type: 'controls_repeat_ext', inputs: { TIMES: input(n(2)), DO: input({ type: 'controls_if', extraState: { hasElse: true }, inputs: {
    IF0: input(compare('EQ', arithmetic('DIVIDE', n(1), n(2)), n(0.5))), DO0: input(print(text('true branch'))), ELSE: input(print(text('WRONG branch'))),
  } }) } },
  set(2),
  { type: 'controls_whileUntil', fields: { MODE: 'WHILE' }, inputs: { BOOL: input(compare('GT', get(), n(0))), DO: input(chain([print(get()), decrement()])) } },
  set(2),
  { type: 'controls_whileUntil', fields: { MODE: 'UNTIL' }, inputs: { BOOL: input(compare('EQ', get(), n(0))), DO: input(chain([print(get()), decrement()])) } },
  print({ type: 'math_modulo', inputs: { DIVIDEND: input(n(7)), DIVISOR: input(n(4)) } }),
  print(text('done')),
])) };
const ws = new Blockly.Workspace();
Blockly.serialization.workspaces.load(state, ws);
const result = generateArduino(ws, 1);
ws.dispose();
assert.deepEqual(result.issues, []);
const folder = resolve('scratch/blockly-runtime');
mkdirSync(folder, { recursive: true });
// A blocked/failed run must not leave a PASS report from an earlier invocation.
writeFileSync(resolve(folder, 'result.json'), JSON.stringify({ pass: false, status: 'incomplete' }, null, 2));
writeFileSync(resolve(folder, 'Arduino.h'), `#pragma once
#include <iostream>
#include <string>
#include <iomanip>
using String = std::string;
struct SerialStub {
  void begin(int) {}
  template<class T> void print(const T& value) { std::cout << value; }
  void print(double value, int) { std::cout << value; }
  template<class T> void println(const T& value) { std::cout << value << '\\n'; }
  void println(double value, int digits) { std::cout << std::fixed << std::setprecision(digits) << value << '\\n' << std::defaultfloat; }
} Serial;
inline void delay(unsigned long) {}
`);
const expected = ['setup once', '1.5', '8', '3', '2', '1', 'true branch', 'true branch', '2', '1', '2', '1', '3', 'done'];
const roundtrip = new Blockly.Workspace();
Blockly.serialization.workspaces.load(cppToWorkspace(result.code, 1), roundtrip);
const converted = generateArduino(roundtrip, 1);
assert.deepEqual(converted.issues, []);
roundtrip.dispose();
// Keep independently authored C++ in this suite too: a round-trip of generated
// code alone cannot catch changes to integer division or pointer/string types.
const semanticsSource = `#include <Arduino.h>
char label[] = "hello";
const char* pointer = label;
void setup() { Serial.begin(115200); }
void loop() {
  Serial.println(8 * 3 / 2);
  Serial.println(8 * 3 % 5);
  Serial.println(10 % 6 * 3);
  Serial.println(8 * (3 / 2));
  Serial.println(pointer == "hello");
  Serial.println(String("hello") == "hello");
  Serial.println(1.2345, 2);
}
`;
const semanticsWorkspace = new Blockly.Workspace();
Blockly.serialization.workspaces.load(cppToWorkspace(semanticsSource, 1), semanticsWorkspace);
const semanticsConverted = generateArduino(semanticsWorkspace, 1);
assert.deepEqual(semanticsConverted.issues, []);
semanticsWorkspace.dispose();
const semanticsExpected = ['12', '4', '12', '8', '0', '1', '1.23'];
const cases = [];
const programs = [
  ['program', result.code, expected], ['roundtrip', converted.code, expected],
  ['semantics-original', semanticsSource, semanticsExpected], ['semantics-roundtrip', semanticsConverted.code, semanticsExpected],
];
for (const [name, code] of programs) {
  const source = resolve(folder, `${name}.cpp`);
  writeFileSync(source, code + '\nint main() { setup(); loop(); }\n');
  const executable = resolve(folder, name + (process.platform === 'win32' ? '.exe' : ''));
  const build = spawnSync('g++', ['-std=c++17', '-Wall', '-Wextra', '-I', folder, source, '-o', executable], { encoding: 'utf8', timeout: 30000 });
  assert.equal(build.status, 0, build.error?.message || build.stderr);
}
for (const [name, , wanted] of programs) {
  const executable = resolve(folder, name + (process.platform === 'win32' ? '.exe' : ''));
  const run = spawnSync(executable, [], { encoding: 'utf8', timeout: 5000 });
  assert.equal(run.status, 0, run.error?.message || run.stderr);
  const actual = run.stdout.trim().split(/\r?\n/);
  assert.deepEqual(actual, wanted, name);
  cases.push({ name, actual });
}
writeFileSync(resolve(folder, 'result.json'), JSON.stringify({ pass: true, expected, cases }, null, 2));
console.log('PASS: original and C++ -> Blockly -> C++ preserve arithmetic, branches, loops, variables, pointer/string comparisons and Serial precision.');
