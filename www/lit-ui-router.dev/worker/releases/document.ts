// The html document around a rendered page, in the docs site's theme.
import { html, render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';

/** The stylesheet the docs build emits from `release-pages.css` beside this module. */
export const STYLESHEET = '/release-pages.css';

/** The script the docs build emits from `release-diff.ts` beside this module. */
export const DIFF_SCRIPT = '/release-diff.js';

/** What the document's head says about the page. */
export interface PageHead {
  title: string;
  description: string;
  /** A module script the page loads. */
  script?: string;
}

// @lit-labs/ssr's server-only `html`: it renders a doctype and binds inside `<title>`, where hydratable templates can't.
// The head repeats VitePress's check-dark-mode script, so the docs site's appearance toggle carries over.
// The halves stay unformatted: the formatter would balance their open and close tags.
// oxfmt-ignore
const opening = (head: PageHead) => html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script id="check-dark-mode">(() => {
const preference = localStorage.getItem('vitepress-theme-appearance') || 'auto';
const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
if (preference === 'auto' ? prefersDark : preference === 'dark') document.documentElement.classList.add('dark');
})()</script>
<title>${head.title} | Lit UI Router</title>
<meta name="description" content=${head.description}>
<link rel="icon" href="/favicon.ico">
<link rel="stylesheet" href=${STYLESHEET}>
${head.script ? html`<script type="module" src=${head.script}></script>` : ''}
</head>
<body>
<header class="site content-grid"><div>
<a class="home" href="/"><img src="/images/lit-ui-router.svg" alt="" width="32" height="32">Lit UI Router</a>
<nav aria-label="Site"><a href="/introduction">Docs</a><a href="/packages/">Packages</a><a href="/releases/">Releases</a><a href="https://github.com/simshanith/lit-ui-router">GitHub</a></nav>
</div></header>
<main class="content-grid"><div>`;

// oxfmt-ignore
const closing = html`</div></main>
<footer class="content-grid"><p>Read from the release ledger. Release notes live on <a href="https://github.com/simshanith/lit-ui-router/releases">GitHub</a>.</p></footer>
</body>
</html>
`;

const renderToString = (template: ReturnType<typeof html>): Promise<string> =>
  collectResult(render(template));

/** Wraps a body lit-ui-router-ssr rendered in the page's html document. */
export const releaseDocument = async (
  body: string,
  head: PageHead,
): Promise<string> =>
  // The body joins as a string: lit-ssr would render the custom elements in an unsafeHTML body a second time.
  `${await renderToString(opening(head))}${body}${await renderToString(closing)}`;
