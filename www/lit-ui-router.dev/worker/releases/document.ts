// The html document around a rendered page, in the docs site's theme.
import { html, render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';

import {
  COPYRIGHT,
  FOOTER_BAR,
  FOOTER_REFERENCES,
} from '../../catalog/footer.ts';
import { FLAMES_MARK } from '../../catalog/mark.ts';
import { NAV, type NavLink } from '../../catalog/navigation.ts';
import { RELEASES_MOUNT } from './routes.ts';
import { REPOSITORY } from './views.ts';

/** The stylesheet the docs build emits from `release-pages.css` beside this module. */
export const STYLESHEET = '/release-pages.css';

/** The script the docs build emits from `release-diff.ts` beside this module. */
export const DIFF_SCRIPT = '/release-diff.js';

// The logo links it.
const HOME = '/';

const RELEASES = `${RELEASES_MOUNT}/`;

/**
 * The header's links: the docs nav as one row. The menu that lists the releases is spread into its
 * pages, any other menu is one link to its first page, and GitHub is the docs header's social link.
 */
export const SITE_LINKS: readonly NavLink[] = [
  ...NAV.flatMap((entry) => {
    if (!('items' in entry)) return [entry];

    return entry.items.some(({ link }) => link === RELEASES)
      ? entry.items
      : entry.items.slice(0, 1).map(({ link }) => ({ text: entry.text, link }));
  }),
  { text: 'GitHub', link: REPOSITORY },
];

/** What the document's head says about the page. */
export interface PageHead {
  title: string;
  description: string;
  /** The page is the releases index, the header's Releases link itself. */
  index?: boolean;
  /** A module script the page loads. */
  script?: string;
  /** Keeps the page out of search indexes. */
  noindex?: boolean;
  /** The pages before and after this one in a series. */
  prev?: string;
  next?: string;
}

// Every page sits under Releases; only the index is the link's own page.
const currentOf = (head: PageHead) => (head.index ? 'page' : 'true');

const siteLink = ({ text, link }: NavLink, head: PageHead) => {
  const current = currentOf(head);

  return link === RELEASES
    ? html`<a href=${link} aria-current=${current}>${text}</a>`
    : html`<a href=${link}>${text}</a>`;
};

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
${head.noindex ? html`<meta name="robots" content="noindex">` : ''}
<link rel="icon" href="/favicon.ico">
${head.prev ? html`<link rel="prev" href=${head.prev}>` : ''}
${head.next ? html`<link rel="next" href=${head.next}>` : ''}
<link rel="stylesheet" href=${STYLESHEET}>
${head.script ? html`<script type="module" src=${head.script}></script>` : ''}
</head>
<body>
<header class="site content-grid"><div>
<a class="home" href=${HOME}><img src="/images/lit-ui-router.svg" alt="" width="32" height="32">Lit UI Router</a>
<nav aria-label="Site">${SITE_LINKS.map((link) => siteLink(link, head))}</nav>
</div></header>
<main class="content-grid"><div>`;

// The docs footer's anchors: another site opens in a new tab.
const footerLink = ({ text, link }: NavLink, current: string) => {
  if (link === RELEASES)
    return html`<a href=${link} aria-current=${current}>${text}</a>`;

  return link.startsWith('/')
    ? html`<a href=${link}>${text}</a>`
    : html`<a href=${link} target="_blank" rel="noopener">${text}</a>`;
};

// The docs site's compact footer (SiteFooter.vue), after the note on where these pages' data comes from.
// oxfmt-ignore
const closing = (current: string) => html`</div>
<p class="provenance">Read from the <a href="/site/#the-release-ledger">release ledger</a>, with release notes from each package's changelog. Most releases are also on <a href=${`${REPOSITORY}/releases`}>GitHub</a>.</p>
</main>
<footer class="site-footer content-grid"><div class="inner">
<div class="top">
<a class="brand" href=${HOME}>
<svg class="mark" xmlns="http://www.w3.org/2000/svg" viewBox=${FLAMES_MARK.viewBox} aria-hidden="true" focusable="false"><path fill="currentColor" d=${FLAMES_MARK.path} /></svg>
<p class="name">Lit UI Router</p>
</a>
<nav class="links" aria-label="Footer"><ul class="list">${FOOTER_BAR.map((link) => html`<li>${footerLink(link, current)}</li>`)}</ul></nav>
</div>
<div class="colophon">
<p><a href=${FOOTER_REFERENCES.uiRouter} target="_blank" rel="noopener">UI-Router</a> for <a href=${FOOTER_REFERENCES.lit} target="_blank" rel="noopener">Lit</a> web components.</p>
<p><a href=${FOOTER_REFERENCES.license} target="_blank" rel="noopener">MIT License</a> &middot; Copyright &copy; ${COPYRIGHT}.</p>
</div>
</div></footer>
</body>
</html>
`;

const renderToString = (template: ReturnType<typeof html>): Promise<string> =>
  collectResult(render(template));

// The closing half has two forms, so each renders once per isolate.
const closings = new Map<string, Promise<string>>();

const closingOf = (current: string): Promise<string> => {
  const rendered = closings.get(current) ?? renderToString(closing(current));

  closings.set(current, rendered);

  return rendered;
};

/** Wraps a body lit-ui-router-ssr rendered in the page's html document. */
export const releaseDocument = async (
  body: string,
  head: PageHead,
): Promise<string> =>
  // The body joins as a string: lit-ssr would render the custom elements in an unsafeHTML body a second time.
  `${await renderToString(opening(head))}${body}${await closingOf(currentOf(head))}`;
