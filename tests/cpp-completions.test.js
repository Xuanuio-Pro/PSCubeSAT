import test from 'node:test';
import assert from 'node:assert/strict';
import { completionsAt, declaredSymbols, stripNonCode } from '../src/components/editor/cpp-completions.js';

const sketch = `#include <PTITCube.h>
// Gợi ý: không lấy chữ trong chú thích
PTIT_Storage storage;
PTIT_CDH cdh(Serial);
const int LED_PIN = 2;
String checked(PTIT_Storage& disk, const String& input) {
  String note = "chuoi tieng viet trong string";
  return disk.handleCommand(input);
}
void blink();
void setup() { cdh.begin(115200); }
void loop() { for (int i = 0; i < 3; i++) blink(); }
void blink() { digitalWrite(LED_PIN, HIGH); }
`;

test('suggestions are only functions and variables, never words from comments, strings or keywords', () => {
  const names = completionsAt(sketch, '  ').map(item => item.name);
  for (const name of ['storage', 'cdh', 'LED_PIN', 'checked', 'disk', 'input', 'note', 'i', 'blink', 'setup', 'loop', 'Serial', 'digitalWrite', 'millis']) assert.ok(names.includes(name), name);
  for (const word of ['Gợi', 'chuoi', 'tieng', 'include', 'PTITCube', 'return', 'for', 'const', 'void', 'HIGH', 'String']) assert.ok(!names.includes(word), word);
  assert.ok(completionsAt(sketch, '  ').every(item => ['function', 'variable'].includes(item.kind)));
  assert.equal(new Set(names).size, names.length);
  assert.equal(stripNonCode('a // b\n"c" d').replace(/\s+/g, ' ').trim(), 'a d');
});

test('after "object." only that object\'s methods are suggested', () => {
  const methods = completionsAt(sketch, '  storage.').map(item => item.name);
  assert.ok(methods.includes('handleCommand') && methods.includes('listDir'));
  assert.ok(!methods.includes('digitalWrite') && !methods.includes('storage'));
  assert.ok(completionsAt(sketch, '  disk.re').some(item => item.name === 'readFile'));
  assert.ok(completionsAt(sketch, '  cdh.').some(item => item.name === 'println'));
  assert.ok(completionsAt(sketch, '  Serial.').some(item => item.name === 'begin'));
  assert.ok(completionsAt(sketch, '  input.').some(item => item.name === 'startsWith'));
  assert.deepEqual(completionsAt(sketch, '  unknownThing.'), []);
  assert.deepEqual(completionsAt(sketch, '  float x = 3.'), []);
  assert.equal(declaredSymbols(sketch).find(item => item.name === 'cdh').kind, 'variable');
  assert.equal(declaredSymbols(sketch).find(item => item.name === 'blink').kind, 'function');
});

test('library 74065b6 API: CDH watchdog/tasks, GPS NMEA helpers and templated queues are suggested', () => {
  const code = 'PTIT_CDH cdh;\nPTIT_GPS gps;\nPTIT_Sensor sensor;\nstruct Ev { int v; };\nPTIT_Queue<Ev> events;\n';
  const names = prefix => completionsAt(code, prefix).map(item => item.name);
  assert.ok(['wdtInit', 'wdtFeed', 'createTask', 'addTask', 'lock', 'delayMs'].every(name => names('  cdh.').includes(name)));
  assert.ok(['readSentence', 'verifyChecksum', 'getNMEAType', 'hasFix'].every(name => names('  gps.').includes(name)));
  assert.ok(['getRoll', 'getPitch', 'getHeading', 'getAltitude'].every(name => names('  sensor.').includes(name)));
  assert.ok(['send', 'receive', 'sendFromISR'].every(name => names('  events.').includes(name)));
  assert.ok(names('  ').includes('ledcSetup') && names('  ').includes('wdtFeed'));
});
