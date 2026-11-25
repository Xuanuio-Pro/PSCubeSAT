/**
 * Check whether the next non-empty line after `startIdx` is indented.
 *
 * @param {string[]} lines
 * @param {number} startIdx
 * @returns {boolean}
 */
function nextNonEmptyIsIndented(lines, startIdx) {
  for (let k = startIdx; k < lines.length; k += 1) {
    const candidate = lines[k];
    if (candidate.trim() === '') continue;
    return /^[ \t]+/.test(candidate);
  }
  return false;
}

/**
 * Normalize single-line and compact multi-line `$$...$$` display math blocks
 * into standard standalone-fence blocks so `remark-math` parses every display
 * formula consistently while preserving list indentation, fenced code blocks,
 * and unclosed fences.
 *
 * @param {string} markdown
 * @returns {string}
 */
export function normalizeDisplayMath(markdown) {
  if (!markdown || typeof markdown !== 'string') return '';

  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  /** @type {string[]} */
  const out = [];
  /** @type {{ char: string, len: number } | null} */
  let codeFence = null;
  let inMathBlock = false;
  let mathIndent = '';
  let activeListIndent = '';
  let prevWasBlank = true;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (codeFence) {
      out.push(line);
      const closeFence = line.match(/^[ \t>]*(`{3,}|~{3,})[ \t]*$/);
      if (closeFence && closeFence[1][0] === codeFence.char && closeFence[1].length >= codeFence.len) {
        codeFence = null;
      }
      prevWasBlank = false;
      continue;
    }

    if (!inMathBlock) {
      const openFence = line.match(/^[ \t>]*(`{3,}|~{3,})(.*)$/);
      if (openFence) {
        const fence = openFence[1];
        const info = openFence[2];
        if (fence[0] !== '`' || !info.includes('`')) {
          if (!/^[ \t]/.test(line)) {
            activeListIndent = '';
          }
          codeFence = { char: fence[0], len: fence.length };
          out.push(line);
          prevWasBlank = false;
          continue;
        }
      }
    }

    const standaloneMatch = line.match(/^([ \t>]*)\$\$\s*$/);
    if (standaloneMatch) {
      if (!inMathBlock) {
        inMathBlock = true;
        mathIndent =
          standaloneMatch[1] === '' &&
          activeListIndent &&
          (!prevWasBlank || nextNonEmptyIsIndented(lines, i + 1))
            ? activeListIndent
            : '';
        out.push(`${mathIndent}${standaloneMatch[1]}$$`);
      } else {
        out.push(mathIndent && !/^[ \t]/.test(line) ? `${mathIndent}$$` : line);
        inMathBlock = false;
        mathIndent = '';
      }
      prevWasBlank = false;
      continue;
    }

    if (inMathBlock) {
      out.push(mathIndent && line.trim() !== '' && !/^[ \t]/.test(line) ? `${mathIndent}${line}` : line);
      prevWasBlank = false;
      continue;
    }

    const singleMatch = line.match(/^([ \t>]*)\$\$(.+?)\$\$\s*$/);
    if (singleMatch && !singleMatch[2].includes('$$')) {
      const prefix = singleMatch[1];
      const effectivePrefix =
        prefix === '' && activeListIndent && (!prevWasBlank || nextNonEmptyIsIndented(lines, i + 1))
          ? activeListIndent
          : prefix;
      out.push(`${effectivePrefix}$$`, `${effectivePrefix}${singleMatch[2].trim()}`, `${effectivePrefix}$$`);
      prevWasBlank = false;
      continue;
    }

    const openMatch = line.match(/^([ \t>]*)\$\$(.+)$/);
    if (openMatch && !openMatch[2].includes('$$')) {
      const prefix = openMatch[1];
      const hasBlockquote = prefix.includes('>');
      let closeIdx = -1;
      /** @type {string[]} */
      const rawBody = [openMatch[2]];

      for (let j = i + 1; j < lines.length; j += 1) {
        const candidate = lines[j];
        if (/^[ \t>]*(`{3,}|~{3,})/.test(candidate)) {
          break;
        }
        const closeMatch = candidate.match(/^(.*)\$\$\s*$/);
        if (closeMatch && !closeMatch[1].includes('$$')) {
          let tail = closeMatch[1];
          if (hasBlockquote) {
            tail = tail.replace(/^[ \t]*(?:>[ \t]*)+/, '');
          }
          rawBody.push(tail);
          closeIdx = j;
          break;
        }
        let bodyLine = candidate;
        if (hasBlockquote) {
          bodyLine = bodyLine.replace(/^[ \t]*(?:>[ \t]*)+/, '');
        }
        rawBody.push(bodyLine);
      }

      if (closeIdx !== -1) {
        const cleaned = rawBody.map(item => item.trimEnd());
        while (cleaned.length > 0 && cleaned[0].trim() === '') cleaned.shift();
        while (cleaned.length > 0 && cleaned[cleaned.length - 1].trim() === '') cleaned.pop();

        const effectivePrefix =
          prefix === '' && activeListIndent && (!prevWasBlank || nextNonEmptyIsIndented(lines, closeIdx + 1))
            ? activeListIndent
            : prefix;

        out.push(`${effectivePrefix}$$`);
        for (const bodyLine of cleaned) {
          out.push(bodyLine.trim() === '' ? effectivePrefix.trimEnd() : `${effectivePrefix}${bodyLine}`);
        }
        out.push(`${effectivePrefix}$$`);
        i = closeIdx;
        prevWasBlank = false;
        continue;
      }
    }

    if (line.trim() === '') {
      prevWasBlank = true;
    } else {
      const listMatch = line.match(/^([ \t]*)([-*+]|\d+\.)([ \t]+)/);
      if (listMatch) {
        activeListIndent = ' '.repeat(listMatch[1].length + listMatch[2].length + listMatch[3].length);
      } else if (!/^[ \t]/.test(line)) {
        activeListIndent = '';
      }
      prevWasBlank = false;
    }

    out.push(line);
  }

  return out.join('\n');
}
