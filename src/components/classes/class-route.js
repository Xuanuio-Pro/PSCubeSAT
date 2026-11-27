// What to do with the first segment after /classes/ before any class page calls the API with it.
// Class ids are numeric; "/classes/lab3" is an old alias of the lab page, anything else is a 404.

/**
 * @param {string} pathname
 * @returns {{ kind: 'pass' } | { kind: 'redirect', to: string } | { kind: 'not-found' }}
 */
export function classRouteTarget(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const match = /^\/classes\/([^/]+)(\/.*)?$/.exec(path);
  if (!match) return { kind: 'pass' };
  const [, segment, rest] = match;
  if (/^\d+$/.test(segment)) return { kind: 'pass' };
  const lab = /^lab([0-8])$/i.exec(segment);
  if (lab && !rest) return { kind: 'redirect', to: `/lab${lab[1]}` };
  return { kind: 'not-found' };
}
