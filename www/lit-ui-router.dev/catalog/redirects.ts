// Data only: the build writes dist/_redirects from it and the dev server answers it; checks live in .vitepress/redirects.ts.
import type { RedirectLine } from 'ui-router-server/prerender';

/** Moved docs URLs, in `_redirects` order: static rules first, first match wins. */
export const REDIRECTS = [
  { from: '/about-this-site', to: '/site/', status: 301 },
] as const satisfies readonly RedirectLine[];
