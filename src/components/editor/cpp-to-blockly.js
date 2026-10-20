import * as Blockly from 'blockly';
import { registerCustomBlocks, allowedBlockTypes } from './blockly-toolbox.js';
import { generateArduino } from './arduino-generator.js';
import { DEFAULT_ARDUINO_CODE, defaultWorkspace } from './blockly-project.js';

// A structural scanner, not a C++ compiler. Unmapped constructs remain explicit C++
// blocks; incomplete delimiters/functions never replace the current workspace.
function scan(code) {
  const tokens = [], stack = [], pairs = new Map();
  let i = 0;
  while (i < code.length) {
    const start = i, char = code[i];
    if (/\s/.test(char)) { i++; continue; }
    if (code.startsWith('//', i)) { const end = code.indexOf('\n', i); i = end < 0 ? code.length : end; continue; }
    if (code.startsWith('/*', i)) {
      const end = code.indexOf('*/', i + 2);
      if (end < 0) throw new Error('Chưa đóng chú thích /* */.');
      i = end + 2; continue;
    }
    if (char === '#' && !code.slice(code.lastIndexOf('\n', i - 1) + 1, i).trim()) {
      do { const end = code.indexOf('\n', i); i = end < 0 ? code.length : end + 1; } while (i < code.length && code[i - 2] === '\\');
    } else if (code.startsWith('R"', i)) {
      const open = code.indexOf('(', i + 2);
      if (open < 0 || open - i > 18) throw new Error('Chuỗi C++ raw chưa hoàn chỉnh.');
      const closing = ')' + code.slice(i + 2, open) + '"';
      const end = code.indexOf(closing, open + 1);
      if (end < 0) throw new Error('Chưa đóng chuỗi C++ raw.');
      i = end + closing.length;
    } else if (char === '"' || char === "'") {
      i++;
      while (i < code.length && code[i] !== char) {
        if (code[i] === '\n') throw new Error('Chuỗi C++ chưa đóng trước khi xuống dòng.');
        i += code[i] === '\\' ? 2 : 1;
      }
      if (i >= code.length) throw new Error('Chưa đóng chuỗi C++.');
      i++;
    } else {
      const word = code.slice(i).match(/^(?:[A-Za-z_]\w*|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[uUlLfF]*|==|!=|<=|>=|&&|\|\||\+\+|--|\+=|-=|\*=|\/=|::|->)/);
      i += word ? word[0].length : 1;
    }
    const value = code.slice(start, i), index = tokens.length;
    tokens.push({ value, start, end: i });
    if (['(', '[', '{'].includes(value)) {
      stack.push(index);
      if (stack.length > 150) throw new Error('Chương trình lồng quá nhiều tầng.');
    } else if ([')', ']', '}'].includes(value)) {
      const open = stack.pop();
      if (open === undefined || tokens[open].value !== ({ ')': '(', ']': '[', '}': '{' })[value]) throw new Error('Dấu ngoặc C++ chưa khớp.');
      pairs.set(open, index);
    }
    if (tokens.length > 50000) throw new Error('Chương trình C++ quá lớn để chuyển sang Blockly.');
  }
  if (stack.length) throw new Error('Chưa đóng đủ dấu ngoặc C++.');
  return { tokens, pairs };
}

const chain = blocks => blocks.reduceRight((next, block) => ({ ...block, ...(next ? { next: { block: next } } : {}) }), null);
const input = block => ({ block });
const number = NUM => ({ type: 'math_number', fields: { NUM } });
const rawExpression = CODE => ({ type: 'cpp_expression', fields: { CODE } });
const stringBlock = code => {
  if (/^"(?:[^"\\]|\\.)*"$/.test(code)) {
    try { return { type: 'text', fields: { TEXT: JSON.parse(code) } }; } catch { /* Keep C++ escapes literal. */ }
  }
  return null;
};

function topLevelIndices(tokens, pairs) {
  const indices = [];
  for (let at = 0; at < tokens.length; at++) {
    if (['(', '[', '{'].includes(tokens[at].value)) { at = pairs.get(at); continue; }
    indices.push(at);
  }
  return indices;
}

function expression(code, allowed = allowedBlockTypes(8), depth = 0) {
  code = code.trim();
  if (!code) throw new Error('Thiếu biểu thức C++.');
  const { tokens, pairs } = scan(code);
  // Long expressions stay editable without deeply recursive parsing or building
  // hundreds of temporary blocks for a single expression.
  if (depth >= 64 || tokens.length > 512) return rawExpression(code);
  if (tokens[0]?.value === '(' && pairs.get(0) === tokens.length - 1) return expression(code.slice(tokens[0].end, tokens.at(-1).start), allowed, depth + 1);
  if (/^[+-]?(?:0|[1-9]\d*)$/.test(code) && Number.isSafeInteger(Number(code))) return number(Number(code));
  if (code === 'true' || code === 'false') return { type: 'logic_boolean', fields: { BOOL: code === 'true' ? 'TRUE' : 'FALSE' } };
  // A C++ string literal is const char[], not Arduino String. Replacing it with
  // the text block can change pointer comparison and overload resolution.
  if (tokens.length === 1 && tokens[0].value.startsWith('"')) return rawExpression(code);
  if (tokens[0]?.value === 'String' && tokens[1]?.value === '(' && pairs.get(1) === tokens.length - 1) {
    return stringBlock(code.slice(tokens[1].end, tokens.at(-1).start).trim()) || rawExpression(code);
  }
  if (/^millis\s*\(\s*\)$/.test(code)) return { type: 'millis_value' };
  const read = code.match(/^(digitalRead|analogRead)\s*\(\s*(0|[1-9]\d*)\s*\)$/);
  if (read && Number(read[2]) <= 48) return { type: read[1] === 'digitalRead' ? 'digital_read' : 'analog_read', fields: { PIN: Number(read[2]) } };
  const values = {
    'sensor.getTemperature()': 'sensor_read_temp', 'sensor.getPressure()': 'sensor_read_pressure',
    'eps.getBatteryVoltage()': 'eps_read_voltage', 'eps.getBatteryPercent()': 'eps_read_percent',
    'gps.hasFix()': 'gps_has_fix', 'lora.update()': 'com_receive',
  };
  const compact = tokens.map(t => t.value).join('');
  if (values[compact] && allowed.has(values[compact])) return { type: values[compact] };
  if (!tokens.some((t, i) => ['?', ':', '=', '+=', '-=', '*=', '/=', '::', '&', '|', '^', ','].includes(t.value) || (['<', '>'].includes(t.value) && tokens[i + 1]?.value === t.value)) && !/\w\s*<[^;]+>\s*\(/.test(code)) {
    const top = topLevelIndices(tokens, pairs);
    for (const operators of [['||'], ['&&'], ['==', '!='], ['<', '<=', '>', '>='], ['+', '-'], ['*', '/', '%']]) {
      const at = top.findLast(index => operators.includes(tokens[index].value) && index > 0 && !['+', '-', '*', '/', '!', '<', '>', '==', '!=', '&&', '||'].includes(tokens[index - 1].value));
      if (at === undefined) continue;
      // These operators share precedence and associate left-to-right. The
      // Blockly divide/modulo blocks use floating arithmetic, so preserve the
      // entire expression if its last operator is integer division/remainder.
      if (['/', '%'].includes(tokens[at].value)) return rawExpression(code);
      const leftText = code.slice(0, tokens[at].start), rightText = code.slice(tokens[at].end);
      const left = expression(leftText, allowed, depth + 1), right = expression(rightText, allowed, depth + 1), operator = tokens[at].value;
      if (['&&', '||'].includes(operator)) {
        const boolean = (value, text) => ['logic_boolean', 'logic_compare', 'logic_operation', 'logic_negate', 'gps_has_fix', 'cpp_expression'].includes(value.type) ? value : rawExpression(text);
        return { type: 'logic_operation', fields: { OP: operator === '&&' ? 'AND' : 'OR' }, inputs: { A: input(boolean(left, leftText)), B: input(boolean(right, rightText)) } };
      }
      const comparison = { '==': 'EQ', '!=': 'NEQ', '<': 'LT', '<=': 'LTE', '>': 'GT', '>=': 'GTE' }[operator];
      if (comparison) return { type: 'logic_compare', fields: { OP: comparison }, inputs: { A: input(left), B: input(right) } };
      if (left.type !== 'text' && right.type !== 'text') return { type: 'math_arithmetic', fields: { OP: { '+': 'ADD', '-': 'MINUS', '*': 'MULTIPLY' }[operator] }, inputs: { A: input(left), B: input(right) } };
      return rawExpression(code);
    }
  }
  // Leave unsupported/overloaded expressions untouched instead of guessing types.
  return rawExpression(code);
}

function simpleStatement(code, allowed, allowInit) {
  const text = code.trim();
  let match = text.match(/^delay\s*\(\s*(0|[1-9]\d*)\s*\)\s*;$/);
  if (match && Number(match[1]) <= 3600000) return { type: 'delay_ms', fields: { MS: Number(match[1]) } };
  match = text.match(/^Serial\.begin\s*\(\s*(0|[1-9]\d*)\s*\)\s*;$/);
  if (match && Number(match[1]) <= 4000000) return { type: 'serial_begin', fields: { BAUD: Number(match[1]) } };
  match = text.match(/^(pinMode|digitalWrite)\s*\(\s*(0|[1-9]\d*)\s*,\s*(OUTPUT|INPUT_PULLUP|INPUT|HIGH|LOW)\s*\)\s*;$/);
  if (match && Number(match[2]) <= 48 && (match[1] === 'pinMode' ? ['OUTPUT', 'INPUT', 'INPUT_PULLUP'] : ['HIGH', 'LOW']).includes(match[3])) {
    return { type: match[1] === 'pinMode' ? 'pin_mode' : 'digital_write', fields: { PIN: Number(match[2]), [match[1] === 'pinMode' ? 'MODE' : 'STATE']: match[3] } };
  }
  match = text.match(/^Serial\.println\s*\(([\s\S]*)\)\s*;$/);
  if (match && match[1].trim()) {
    const args = scan(match[1]);
    // println(value, precision/base) is an overload, not a comma expression.
    if (!topLevelIndices(args.tokens, args.pairs).some(at => args.tokens[at].value === ',')) {
      return { type: 'serial_print', inputs: { VALUE: input(stringBlock(match[1].trim()) || expression(match[1], allowed)) } };
    }
  }
  const compact = scan(text).tokens.map(t => t.value).join('');
  const calls = {
    'sensor.init();': 'sensor_init', 'eps.init();': 'eps_init', 'gps.init();': 'gps_init',
    'lora.init();': 'com_init', 'storage.init();': 'storage_init', 'cdh.init();': 'cdh_init',
    'sensor.update();': 'sensor_update', 'eps.update();': 'eps_update', 'cdh.update();': 'cdh_update',
  };
  if (calls[compact] && allowed.has(calls[compact]) && (!calls[compact].endsWith('_init') || allowInit)) return { type: calls[compact] };
  if (allowInit && allowed.has('sensor_init')) {
    if (compact === 'sensor.init(true,false,false);') return { type: 'sensor_init', fields: { SENSORS: 'ENV' } };
    if (compact === 'sensor.init(false,true,true);') return { type: 'sensor_init', fields: { SENSORS: 'IMU' } };
  }
  if (allowInit && allowed.has('camera_init') && (compact === 'camera.init(12,14);' || compact === 'camera.init(255,255);')) return { type: 'camera_init', fields: { CONNECTION: compact === 'camera.init(12,14);' ? 'MUX' : 'DIRECT' } };
  // Hardware calls remain literal C++ after text import. This avoids adding
  // implicit init/update calls or silently crossing a lab's hardware boundary.
  return { type: 'cpp_statement', fields: { CODE: text } };
}

class BodyParser {
  constructor(code, allowed, allowInit = false) { this.code = code; const scanned = scan(code); this.tokens = scanned.tokens; this.pairs = scanned.pairs; this.at = 0; this.count = 0; this.allowed = allowed; this.allowInit = allowInit; }
  text(from, to) { return this.code.slice(this.tokens[from].start, this.tokens[to - 1].end); }
  body() {
    if (this.tokens[this.at]?.value === '{') {
      const end = this.pairs.get(this.at), start = this.tokens[this.at].end;
      const nested = new BodyParser(this.code.slice(start, this.tokens[end].start), this.allowed);
      const result = nested.sequence();
      this.count += nested.count;
      this.at = end + 1;
      return result;
    }
    return [this.statement()];
  }
  statement() {
    const start = this.at, token = this.tokens[start]?.value;
    if (++this.count > 500) throw new Error('Bài chuyển đổi vượt quá 500 block.');
    if (token === 'if' || token === 'while') {
      if (this.tokens[start + 1]?.value !== '(') throw new Error(`Thiếu điều kiện của ${token}.`);
      const close = this.pairs.get(start + 1);
      const conditionText = this.code.slice(this.tokens[start + 1].end, this.tokens[close].start);
      const parsedCondition = expression(conditionText, this.allowed);
      const condition = ['logic_boolean', 'logic_compare', 'logic_operation', 'logic_negate', 'gps_has_fix', 'cpp_expression'].includes(parsedCondition.type) ? parsedCondition : rawExpression(conditionText);
      this.at = close + 1;
      const body = chain(this.body());
      if (token === 'while') {
        // Preserve while semantics exactly: the regular loop generator yields;
        // importing text must not add an extra delay to the original program.
        const end = this.at;
        return { type: 'cpp_statement', fields: { CODE: this.text(start, end) } };
      }
      /** @type {Record<string, {block: any}>} */
      const inputs = { IF0: input(condition), ...(body ? { DO0: input(body) } : {}) };
      if (this.tokens[this.at]?.value === 'else') {
        this.at++;
        const alternate = chain(this.body());
        if (alternate) inputs.ELSE = input(alternate);
        return { type: 'controls_if', extraState: { hasElse: true }, inputs };
      }
      return { type: 'controls_if', inputs };
    }
    // A complete statement can contain nested calls, initializer lists, for,
    // switch, lambdas, do/while, etc. Keep its entire spelling in a C++ block.
    while (this.at < this.tokens.length) {
      const current = this.tokens[this.at].value;
      if (current === ';') { this.at++; return simpleStatement(this.text(start, this.at), this.allowed, this.allowInit); }
      if (current === '(' || current === '[') { this.at = this.pairs.get(this.at) + 1; continue; }
      if (current === '{') {
        this.at = this.pairs.get(this.at) + 1;
        if (this.tokens[this.at]?.value === 'else' || (token === 'do' && this.tokens[this.at]?.value === 'while')) { this.at++; continue; }
        if (this.tokens[this.at]?.value === ';') this.at++;
        return { type: 'cpp_statement', fields: { CODE: this.text(start, this.at) } };
      }
      this.at++;
    }
    throw new Error('Lệnh C++ chưa hoàn chỉnh hoặc thiếu dấu chấm phẩy.');
  }
  sequence() {
    const blocks = [], initializers = new Set();
    while (this.at < this.tokens.length) {
      const start = this.at;
      let block = this.statement();
      if (block.type.endsWith('_init')) {
        if (initializers.has(block.type)) block = { type: 'cpp_statement', fields: { CODE: this.text(start, this.at) } };
        else initializers.add(block.type);
      }
      blocks.push(block);
    }
    return blocks;
  }
}

export function cppToWorkspace(code, labId) {
  if (typeof code !== 'string' || code.length > 1000000) throw new Error('C++ hỗ trợ tối đa 1 MB.');
  registerCustomBlocks();
  if (code.trim() === DEFAULT_ARDUINO_CODE.trim()) return defaultWorkspace();
  const { tokens, pairs } = scan(code), blocks = [], found = new Set();
  let cursor = 0, i = 0;
  const globals = fragment => {
    const value = fragment.replace(/^\s*#include\s*[<"](?:Arduino\.h|math\.h)[>"]\s*$/gm, '').trim();
    if (value) blocks.push({ type: 'cpp_globals', fields: { CODE: value } });
  };
  while (i < tokens.length) {
    const name = tokens[i + 1]?.value;
    if (tokens[i].value === 'void' && ['setup', 'loop'].includes(name)) {
      if (found.has(name)) throw new Error(`Chỉ được có một hàm ${name}().`);
      if (tokens[i + 2]?.value !== '(' || tokens[i + 3]?.value !== ')' || tokens[i + 4]?.value !== '{') throw new Error(`Cần đúng chữ ký void ${name}() { ... }.`);
      const end = pairs.get(i + 4);
      globals(code.slice(cursor, tokens[i].start));
      const parser = new BodyParser(code.slice(tokens[i + 4].end, tokens[end].start), allowedBlockTypes(labId), name === 'setup');
      const body = chain(parser.sequence());
      blocks.push({ type: name === 'setup' ? 'arduino_setup' : 'arduino_loop', data: 'cpp-sync', ...(body ? { inputs: { DO: input(body) } } : {}) });
      found.add(name);
      cursor = tokens[end].end;
      i = end + 1;
      continue;
    }
    if (['{', '(', '['].includes(tokens[i].value)) i = pairs.get(i) + 1;
    else i++;
  }
  if (found.size !== 2) throw new Error('Cần đủ hai hàm void setup() và void loop() để đồng bộ Blockly.');
  globals(code.slice(cursor));
  let y = 30;
  const state = { blocks: { languageVersion: 0, blocks: blocks.map(block => ({ ...block, x: 30, y: (y += 180) - 180 })) } };
  const candidate = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(state, candidate);
    if (candidate.getAllBlocks(false).length > 500) throw new Error('Bài chuyển đổi vượt quá 500 block.');
    const result = generateArduino(candidate, labId);
    if (result.issues.length) throw new Error(result.issues.map(issue => issue.message).join(' '));
    return state;
  } finally { candidate.dispose(); }
}
