import { stripLastPathElement } from '@uirouter/core';

/**
 * Composes the absolute URL handed to `navigation.navigate()` from a
 * router-relative `url` and the document's `baseHref`.
 *
 * Pure string math — no DOM, no Navigation API.
 *
 * - `''` and `'/'` resolve to `baseHref` itself (so `<base href='/app/'>`
 *   navigates to `/app/`, not `/app`).
 * - anything else is prefixed with the base prefix
 *   ({@link stripLastPathElement} of `baseHref`), inserting the leading slash
 *   the caller may have omitted.
 *
 * @internal
 */
export function composeNavigateUrl(url: string, baseHref: string): string {
  if (url === '' || url === '/') {
    return baseHref;
  }
  const slash = url.startsWith('/') ? '' : '/';
  return stripLastPathElement(baseHref) + slash + url;
}
