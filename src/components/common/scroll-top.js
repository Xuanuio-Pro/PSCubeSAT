export const SCROLL_TOP_THRESHOLD = 420;

export function isPageScrollTarget(target, doc = typeof document !== 'undefined' ? document : null) {
  if (!target) return false;
  if (doc && (target === doc || target === doc.documentElement || target === doc.body)) {
    return true;
  }
  return Boolean(target.classList?.contains('player-main'));
}

export function readScrollState(
  win = typeof window !== 'undefined' ? window : null,
  doc = typeof document !== 'undefined' ? document : null,
) {
  const windowY = win
    ? win.scrollY || doc?.documentElement?.scrollTop || doc?.body?.scrollTop || 0
    : 0;
  const playerMain = doc?.querySelector?.('.player-main') || null;
  const playerY = playerMain ? playerMain.scrollTop || 0 : 0;
  const offset = Math.max(windowY, playerY);
  return {
    visible: offset >= SCROLL_TOP_THRESHOLD,
    windowY,
    playerY,
    offset,
  };
}

export function scrollPageToTop(
  win = typeof window !== 'undefined' ? window : null,
  doc = typeof document !== 'undefined' ? document : null,
) {
  const reducedMotion = Boolean(win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  const behavior = reducedMotion ? 'auto' : 'smooth';
  const playerMain = doc?.querySelector?.('.player-main') || null;
  if (playerMain && playerMain.scrollTop > 0) {
    playerMain.scrollTo({ top: 0, behavior });
  }
  const windowY = win
    ? win.scrollY || doc?.documentElement?.scrollTop || doc?.body?.scrollTop || 0
    : 0;
  if (win && windowY > 0) {
    win.scrollTo({ top: 0, behavior });
  }
}
