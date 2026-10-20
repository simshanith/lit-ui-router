// The html document around a rendered page, in the docs site's colours, with no client script.
/** The stylesheet, a static asset from the docs site's `public/`. */
export const STYLESHEET = '/release-pages.css';

const escapeHtml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** What the document's head says about the page. */
export interface PageHead {
  title: string;
  description: string;
}

/** Wraps a rendered body in the page's html document. */
export const releaseDocument = (body: string, head: PageHead): string =>
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(head.title)} | Lit UI Router</title>
<meta name="description" content="${escapeHtml(head.description)}">
<link rel="icon" href="/favicon.ico">
<link rel="stylesheet" href="${STYLESHEET}">
</head>
<body>
<header class="site content-grid"><div>
<a class="home" href="/"><img src="/images/lit-ui-router.svg" alt="" width="32" height="32">Lit UI Router</a>
<nav aria-label="Site"><a href="/introduction">Docs</a><a href="/packages/">Packages</a><a href="/gh/releases/">Releases</a><a href="https://github.com/simshanith/lit-ui-router">GitHub</a></nav>
</div></header>
<main class="content-grid"><div>${body}</div></main>
<footer class="content-grid"><p>Read from the release ledger. Release notes live on <a href="https://github.com/simshanith/lit-ui-router/releases">GitHub</a>.</p></footer>
</body>
</html>
`;
