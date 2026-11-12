import { stripLastPathElement } from '@uirouter/core';

/**
 * Composes the absolute URL handed to `navigation.navigate()` from a
 * router-relative `url` and the document's `baseHref`.
 *
 * Pure string math — no DOM, no Navigation API.
 *
 * - `''` and `'/'` resolve to `baseHref` itself (so `<base href='/app/'>`
 *   navigates to `/app/`, not `/app`).
 * - a leading run of slashes in `url` counts as one, so the result never
 *   begins with `//` and names another host.
 * - anything else is prefixed with the base prefix
 *   ({@link stripLastPathElement} of `baseHref`), inserting the leading slash
 *   the caller may have omitted.
 *
 * @internal
 */
export function composeNavigateUrl(url: string, baseHref: string): string {
  const path = url.replace(/^\/+/, '');

  if (path === '') {
    return baseHref;
  }

  return `${stripLastPathElement(baseHref)}/${path}`;
}
