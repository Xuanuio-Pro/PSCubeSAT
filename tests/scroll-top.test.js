import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  SCROLL_TOP_THRESHOLD,
  isPageScrollTarget,
  readScrollState,
  scrollPageToTop,
} from '../src/components/common/scroll-top.js';

test('readScrollState shows button when window or .player-main scrolls past threshold', () => {
  const playerMain = { scrollTop: 0 };
  const doc = {
    documentElement: { scrollTop: 0 },
    body: { scrollTop: 0 },
    querySelector: (sel) => (sel === '.player-main' ? playerMain : null),
  };
  const win = { scrollY: 0 };

  assert.equal(readScrollState(win, doc).visible, false);

  win.scrollY = SCROLL_TOP_THRESHOLD - 1;
  assert.equal(readScrollState(win, doc).visible, false);

  win.scrollY = SCROLL_TOP_THRESHOLD;
  assert.equal(readScrollState(win, doc).visible, true);

  win.scrollY = 0;
  playerMain.scrollTop = SCROLL_TOP_THRESHOLD + 50;
  assert.equal(readScrollState(win, doc).visible, true);
});

test('scrollPageToTop scrolls active page container to top and respects reduced motion', () => {
  const calls = [];
  const playerMain = {
    scrollTop: 800,
    scrollTo: (opts) => calls.push(['player', opts]),
  };
  const doc = {
    documentElement: { scrollTop: 0 },
    body: { scrollTop: 0 },
    querySelector: (sel) => (sel === '.player-main' ? playerMain : null),
  };
  const win = {
    scrollY: 600,
    matchMedia: () => ({ matches: false }),
    scrollTo: (opts) => calls.push(['window', opts]),
  };

  scrollPageToTop(win, doc);
  assert.deepEqual(calls, [
    ['player', { top: 0, behavior: 'smooth' }],
    ['window', { top: 0, behavior: 'smooth' }],
  ]);

  calls.length = 0;
  win.matchMedia = () => ({ matches: true });
  scrollPageToTop(win, doc);
  assert.deepEqual(calls, [
    ['player', { top: 0, behavior: 'auto' }],
    ['window', { top: 0, behavior: 'auto' }],
  ]);
});

test('isPageScrollTarget ignores unrelated scrollable inner panels', () => {
  const doc = {
    documentElement: { nodeName: 'HTML' },
    body: { nodeName: 'BODY' },
  };
  assert.equal(isPageScrollTarget(doc, doc), true);
  assert.equal(isPageScrollTarget(doc.documentElement, doc), true);
  assert.equal(isPageScrollTarget({ classList: { contains: (c) => c === 'player-main' } }, doc), true);
  assert.equal(isPageScrollTarget({ classList: { contains: () => false } }, doc), false);
});

test('ScrollToTopButton renders triple upward chevron SVG and accessible label', () => {
  const jsxPath = fileURLToPath(new URL('../src/components/common/ScrollToTopButton.jsx', import.meta.url));
  const source = readFileSync(jsxPath, 'utf-8');
  assert.match(source, /aria-label="Cuộn lên đầu trang"/);
  assert.equal((source.match(/<path\b/g) || []).length, 3);
});
