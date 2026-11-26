const LANGUAGE_ALIASES = {
  cpp: 'cpp',
  'c++': 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  ino: 'cpp',
  arduino: 'cpp',
  c: 'c',
  h: 'c',
  py: 'python',
  python: 'python',
  js: 'javascript',
  jsx: 'javascript',
  javascript: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  typescript: 'typescript',
  json: 'json',
  sh: 'bash',
  bash: 'bash',
  shell: 'bash',
  zsh: 'bash',
};

const LANGUAGE_LABELS = {
  cpp: 'C++',
  c: 'C',
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  json: 'JSON',
  bash: 'Bash',
  text: 'Plain Text',
};

const LANGUAGE_EXTENSIONS = {
  cpp: 'cpp',
  c: 'c',
  python: 'py',
  javascript: 'js',
  typescript: 'ts',
  json: 'json',
  bash: 'sh',
  text: 'txt',
};

const CONTROL_KEYWORDS = new Set([
  'if',
  'else',
  'for',
  'while',
  'do',
  'switch',
  'case',
  'default',
  'break',
  'continue',
  'return',
  'goto',
  'try',
  'catch',
  'throw',
  'finally',
  'import',
  'export',
  'from',
  'as',
  'yield',
  'await',
  'pass',
  'raise',
  'with',
  'elif',
]);

const DECLARATION_KEYWORDS = new Set([
  'const',
  'constexpr',
  'static',
  'volatile',
  'extern',
  'inline',
  'register',
  'typedef',
  'typename',
  'template',
  'class',
  'struct',
  'union',
  'enum',
  'namespace',
  'using',
  'public',
  'private',
  'protected',
  'virtual',
  'override',
  'new',
  'delete',
  'sizeof',
  'auto',
  'void',
  'bool',
  'boolean',
  'char',
  'short',
  'int',
  'long',
  'float',
  'double',
  'signed',
  'unsigned',
  'byte',
  'word',
  'size_t',
  'int8_t',
  'uint8_t',
  'int16_t',
  'uint16_t',
  'int32_t',
  'uint32_t',
  'int64_t',
  'uint64_t',
  'true',
  'false',
  'nullptr',
  'NULL',
  'this',
  'def',
  'lambda',
  'None',
  'True',
  'False',
  'function',
  'let',
  'var',
  'async',
  'typeof',
  'instanceof',
  'null',
  'undefined',
  'in',
  'not',
  'and',
  'or',
]);

const BUILTIN_TYPES = new Set([
  'String',
  'Serial',
  'Serial1',
  'Serial2',
  'Wire',
  'SPI',
  'WiFi',
  'WebServer',
  'HTTPClient',
  'File',
  'FS',
  'SD',
  'HardwareSerial',
  'TwoWire',
  'PTITCube',
]);

const PREPROCESSOR_RE = /^#(include|define|ifdef|ifndef|endif|if|else|elif|pragma)\b/;
const NUMBER_RE = /^(?:0[xX][0-9a-fA-F]+|0[bB][01]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?:[uUlLfF]+)?\b/;
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*/;
const PASCAL_CASE_RE = /^[A-Z][A-Za-z0-9_]*[a-z][A-Za-z0-9_]*$/;
const ALL_CAPS_RE = /^[A-Z][A-Z0-9_]+$/;

/**
 * Normalize a fenced code block language string to a canonical key.
 *
 * @param {string} [rawLang]
 * @returns {'cpp' | 'c' | 'python' | 'javascript' | 'typescript' | 'json' | 'bash' | 'text'}
 */
export function normalizeCodeLanguage(rawLang = '') {
  const cleaned = String(rawLang || '')
    .trim()
    .toLowerCase()
    .replace(/^language-/, '');
  return /** @type {'cpp' | 'c' | 'python' | 'javascript' | 'typescript' | 'json' | 'bash' | 'text'} */ (
    LANGUAGE_ALIASES[cleaned] || 'text'
  );
}

/**
 * Format a normalized or raw language identifier for the code block header badge.
 *
 * @param {string} [lang]
 * @returns {string}
 */
export function formatCodeLanguageLabel(lang = '') {
  const normalized = normalizeCodeLanguage(lang);
  return LANGUAGE_LABELS[normalized] || LANGUAGE_LABELS.text;
}

/**
 * Resolve a safe file extension for downloading a fenced code block.
 *
 * @param {string} [lang]
 * @returns {string}
 */
export function getCodeFileExtension(lang = '') {
  const normalized = normalizeCodeLanguage(lang);
  return LANGUAGE_EXTENSIONS[normalized] || LANGUAGE_EXTENSIONS.text;
}

/**
 * Append a token while splitting any embedded newlines into separate line arrays
 * so line numbers always correspond 1-to-1 with source lines.
 *
 * @param {Array<Array<{ type: string, value: string }>>} lines
 * @param {string} type
 * @param {string} value
 */
function pushTokenAcrossLines(lines, type, value) {
  const parts = value.split('\n');
  for (let i = 0; i < parts.length; i += 1) {
    if (i > 0) {
      lines.push([]);
    }
    const segment = parts[i];
    if (segment.length > 0) {
      const current = lines[lines.length - 1];
      const prev = current[current.length - 1];
      if (prev && prev.type === type) {
        prev.value += segment;
      } else {
        current.push({ type, value: segment });
      }
    }
  }
}

/**
 * Scan a quoted string literal starting at `start` (index of opening quote).
 *
 * @param {string} source
 * @param {number} start
 * @param {boolean} allowMultiline
 * @returns {number}
 */
function scanQuoted(source, start, allowMultiline) {
  const quote = source[start];
  let idx = start + 1;
  while (idx < source.length) {
    const ch = source[idx];
    if (ch === '\\' && idx + 1 < source.length) {
      idx += 2;
      continue;
    }
    if (ch === quote) {
      return idx + 1;
    }
    if (ch === '\n' && !allowMultiline) {
      return idx;
    }
    idx += 1;
  }
  return source.length;
}

/**
 * Tokenize source code into per-line VS Code Dark+ syntax tokens.
 * Concatenating all token values across lines reproduces the normalized input exactly.
 *
 * @param {string} code
 * @param {string} [rawLang='']
 * @returns {Array<Array<{ type: string, value: string }>>}
 */
export function tokenizeCodeLines(code, rawLang = '') {
  if (typeof code !== 'string') return [[]];
  const source = code.replace(/\r\n?/g, '\n').replace(/\n$/, '');
  const lang = normalizeCodeLanguage(rawLang);

  if (lang === 'text') {
    return source.split('\n').map(line => (line ? [{ type: 'plain', value: line }] : []));
  }

  /** @type {Array<Array<{ type: string, value: string }>>} */
  const lines = [[]];
  const isCLike = lang === 'cpp' || lang === 'c' || lang === 'javascript' || lang === 'typescript';
  const supportsHashComment = lang === 'python' || lang === 'bash';
  const supportsPreprocessor = lang === 'cpp' || lang === 'c';

  let expectIncludeHeader = false;
  let afterMemberDot = false;
  let pos = 0;

  while (pos < source.length) {
    const ch = source[pos];

    if (ch === '\n') {
      lines.push([]);
      expectIncludeHeader = false;
      afterMemberDot = false;
      pos += 1;
      continue;
    }

    if (ch === ' ' || ch === '\t') {
      let end = pos + 1;
      while (end < source.length && (source[end] === ' ' || source[end] === '\t')) end += 1;
      pushTokenAcrossLines(lines, 'punctuation', source.slice(pos, end));
      pos = end;
      continue;
    }

    if ((isCLike && source[pos] === '/' && source[pos + 1] === '/') || (supportsHashComment && ch === '#')) {
      const nl = source.indexOf('\n', pos);
      const end = nl === -1 ? source.length : nl;
      pushTokenAcrossLines(lines, 'comment', source.slice(pos, end));
      afterMemberDot = false;
      pos = end;
      continue;
    }

    if (isCLike && source[pos] === '/' && source[pos + 1] === '*') {
      const close = source.indexOf('*/', pos + 2);
      const end = close === -1 ? source.length : close + 2;
      pushTokenAcrossLines(lines, 'comment', source.slice(pos, end));
      afterMemberDot = false;
      pos = end;
      continue;
    }

    if (supportsPreprocessor && ch === '#') {
      const match = source.slice(pos).match(PREPROCESSOR_RE);
      if (match) {
        pushTokenAcrossLines(lines, 'preprocessor', match[0]);
        expectIncludeHeader = match[1] === 'include';
        afterMemberDot = false;
        pos += match[0].length;
        continue;
      }
    }

    if (expectIncludeHeader && ch === '<') {
      const close = source.indexOf('>', pos + 1);
      const nl = source.indexOf('\n', pos);
      if (close !== -1 && (nl === -1 || close < nl)) {
        pushTokenAcrossLines(lines, 'string', source.slice(pos, close + 1));
        expectIncludeHeader = false;
        afterMemberDot = false;
        pos = close + 1;
        continue;
      }
    }

    if (ch === '"' || ch === "'" || (ch === '`' && (lang === 'javascript' || lang === 'typescript' || lang === 'bash'))) {
      const allowMultiline = ch === '`' || (lang === 'python' && source.slice(pos, pos + 3) === ch.repeat(3));
      let end;
      if (lang === 'python' && source.slice(pos, pos + 3) === ch.repeat(3)) {
        const close = source.indexOf(ch.repeat(3), pos + 3);
        end = close === -1 ? source.length : close + 3;
      } else {
        end = scanQuoted(source, pos, allowMultiline);
      }
      let tokenType = 'string';
      if (lang === 'json' && ch === '"') {
        const rest = source.slice(end);
        if (/^[ \t]*:/.test(rest)) {
          tokenType = 'property';
        }
      }
      pushTokenAcrossLines(lines, tokenType, source.slice(pos, end));
      expectIncludeHeader = false;
      afterMemberDot = false;
      pos = end;
      continue;
    }

    const numMatch = source.slice(pos).match(NUMBER_RE);
    if (numMatch) {
      pushTokenAcrossLines(lines, 'number', numMatch[0]);
      expectIncludeHeader = false;
      afterMemberDot = false;
      pos += numMatch[0].length;
      continue;
    }

    const identMatch = source.slice(pos).match(IDENT_RE);
    if (identMatch) {
      const word = identMatch[0];
      const end = pos + word.length;
      const followedByParen = /^[ \t]*\(/.test(source.slice(end));

      let tokenType = 'variable';
      if (CONTROL_KEYWORDS.has(word)) {
        tokenType = 'control';
      } else if (DECLARATION_KEYWORDS.has(word)) {
        tokenType = 'keyword';
      } else if (followedByParen) {
        tokenType = 'function';
      } else if (BUILTIN_TYPES.has(word) || PASCAL_CASE_RE.test(word)) {
        tokenType = 'type';
      } else if (ALL_CAPS_RE.test(word)) {
        tokenType = 'constant';
      } else if (afterMemberDot) {
        tokenType = 'property';
      }

      pushTokenAcrossLines(lines, tokenType, word);
      expectIncludeHeader = false;
      afterMemberDot = false;
      pos = end;
      continue;
    }

    if (ch === '.' || (source[pos] === '-' && source[pos + 1] === '>')) {
      const op = ch === '.' ? '.' : '->';
      pushTokenAcrossLines(lines, 'punctuation', op);
      afterMemberDot = true;
      pos += op.length;
      continue;
    }

    pushTokenAcrossLines(lines, 'punctuation', ch);
    afterMemberDot = false;
    pos += 1;
  }

  return lines;
}
