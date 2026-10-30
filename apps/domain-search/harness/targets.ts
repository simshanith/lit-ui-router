// The two pages the harness measures, described the same way.

/** A boolean expression evaluated in the page. */
type Probe = string;

export interface Target {
  name: string;
  /** The page with no query. */
  idle: string;
  /** The page prefilled with `query`. */
  withQuery: (query: string) => string;
  /** The search input. */
  input: string;
  /** Requests held back to keep the app from booting. */
  appScripts: RegExp;
  /** True while the hero (no-query) layout shows. */
  hero: Probe;
  /** True while a results skeleton or results show. */
  skeleton: Probe;
  /** True once the app has booted. */
  booted: Probe;
  /** Read-only third-party page: assertions report, the CI gate never runs it. */
  external: boolean;
}

const shown = (selector: string): Probe =>
  `(() => { const el = document.querySelector(${JSON.stringify(selector)}); return !!el && el.checkVisibility(); })()`;

/** This repo's page, served at `<origin>/domain-search`. */
export const ours = (origin: string): Target => {
  const base = `${origin.replace(/\/+$/, '')}/domain-search`;

  return {
    name: 'lit-ui-router',
    idle: base,
    withQuery: (query) => `${base}?q=${encodeURIComponent(query)}`,
    input: '#domain-search-q',
    appScripts: /\/assets\/[^/]+\.js$/,
    hero: shown('.hero-title'),
    skeleton: `${shown('.skeleton')} || ${shown('.results')}`,
    booted: `document.documentElement.hasAttribute('data-domain-search-booted')`,
    external: false,
  };
};

const text = (needle: string): Probe =>
  `document.body.innerText.includes(${JSON.stringify(needle)})`;

/** vercel.com/domains, whose search input the bar is set by. */
export const vercel: Target = {
  name: 'vercel.com/domains',
  idle: 'https://vercel.com/domains',
  withQuery: (query) =>
    `https://vercel.com/domains/search?q=${encodeURIComponent(query)}`,
  input: '#domains-search-input',
  appScripts: /\/_next\/static\/.+\.js$/,
  hero: text('Find a domain for'),
  skeleton: text('Top Results'),
  booted: `'next' in window && document.readyState === 'complete'`,
  external: true,
};
