export const WIDE_DIAGRAM_WIDTH = 960;
export const DEFAULT_READABLE_SCALE = 0.8;
export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 3.0;

/**
 * Extract intrinsic SVG width and height from `viewBox` or numeric `width`/`height` attributes.
 *
 * @param {string} svg
 * @returns {{ width: number, height: number } | null}
 */
export function parseSvgDimensions(svg) {
  if (!svg || typeof svg !== 'string') return null;

  const svgTagMatch = svg.match(/<svg\b([^>]*)>/i);
  if (!svgTagMatch) return null;
  const attrs = svgTagMatch[1];

  const viewBoxMatch = attrs.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && Number.isFinite(parts[2]) && Number.isFinite(parts[3]) && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }

  const widthMatch = attrs.match(/\bwidth\s*=\s*["']([0-9.]+)(?:px)?["']/i);
  const heightMatch = attrs.match(/\bheight\s*=\s*["']([0-9.]+)(?:px)?["']/i);
  if (widthMatch && heightMatch) {
    const width = Number(widthMatch[1]);
    const height = Number(heightMatch[1]);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return { width, height };
    }
  }

  return null;
}

/**
 * Compute inline card layout parameters for a rendered Mermaid SVG.
 *
 * @param {{ width: number, height: number } | null} dims
 * @param {'readable' | 'actual' | 'fit'} [mode='fit']
 * @returns {{ isWide: boolean, mode: 'readable' | 'actual' | 'fit', displayWidthPx: number | null, fitContainer: boolean }}
 */
export function computeInlineMermaidLayout(dims, mode = 'fit') {
  const isWide = Boolean(dims && dims.width > WIDE_DIAGRAM_WIDTH);

  if (!dims || !isWide || mode === 'fit') {
    return {
      isWide,
      mode: 'fit',
      displayWidthPx: dims ? Math.round(dims.width) : null,
      fitContainer: true,
    };
  }

  if (mode === 'actual') {
    return {
      isWide: true,
      mode: 'actual',
      displayWidthPx: Math.round(dims.width),
      fitContainer: false,
    };
  }

  return {
    isWide: true,
    mode: 'readable',
    displayWidthPx: Math.max(WIDE_DIAGRAM_WIDTH, Math.round(dims.width * DEFAULT_READABLE_SCALE)),
    fitContainer: false,
  };
}

/**
 * Clamp modal zoom level to `[MIN_ZOOM, MAX_ZOOM]`, rounded to 2 decimal places.
 *
 * @param {number} zoom
 * @returns {number}
 */
export function clampZoom(zoom) {
  if (!Number.isFinite(zoom)) return 1;
  const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
  return Math.round(clamped * 100) / 100;
}

/**
 * Compute a zoom factor that fits the SVG comfortably inside the fullscreen modal canvas.
 *
 * @param {{ width: number, height: number } | null} dims
 * @param {number} viewportWidth
 * @param {number} viewportHeight
 * @returns {number}
 */
export function computeFitZoom(dims, viewportWidth, viewportHeight) {
  if (!dims || viewportWidth <= 0 || viewportHeight <= 0 || dims.width <= 0 || dims.height <= 0) {
    return 1;
  }
  const scale = Math.min((viewportWidth - 48) / dims.width, (viewportHeight - 48) / dims.height);
  return clampZoom(Math.min(1.5, Math.max(MIN_ZOOM, scale)));
}
