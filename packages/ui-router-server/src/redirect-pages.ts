/**
 * Redirect pages for static hosts without redirect rules: each rules line
 * becomes an HTML page at its `from` path that sends the browser to its `to`.
 */

import escapeHtml from 'escape-html';

import type { RedirectLine, RulesWriter } from './prerender.ts';

/** Options for {@link redirectPages}. */
export interface RedirectPagesOptions {
  /**
   * The url path `outDir` is served at, `/` by default. Each line's `from`
   * must lie under it; the page lands at the rest of the path.
   */
  base?: string;
  /**
   * Also writes the `_redirects` file, for a site deployed both to a host
   * that reads it and to one that doesn't. The host that reads it answers
   * with the line's status before the page is reached.
   */
  redirectsFile?: boolean;
  /**
   * Builds each page's HTML from its line, {@link redirectPage} by default.
   * Wrap that to add to the page, or replace it. `to` arrives unescaped:
   * HTML-escape it in markup, with `escape-html` (a dependency of this
   * package) or your template's own escaper, and escape it as a script string
   * too if it goes in a script.
   */
  page?: (line: RedirectLine) => string | Promise<string>;
}

/** The `_redirects` file body for the lines: one `from to status` line each. */
export const redirectsFileBody = (lines: readonly RedirectLine[]): string =>
  lines.map((line) => `${line.from} ${line.to} ${line.status}\n`).join('');

// JSON in a script: `<` escaped so the target can't close the element.
const scriptString = (text: string): string =>
  JSON.stringify(text).replace(/</g, '\\u003c');

/**
 * The default redirect page for one line: a `location.replace` that carries
 * the request's query and fragment when the target has none of its own, a
 * meta refresh and a plain link for browsers without script, a canonical link
 * to the target, and `noindex`. The target is escaped in markup and script.
 *
 * @param line - the rules line; the page uses its `to`
 * @returns the page's HTML
 *
 * @example
 * ```ts
 * import { redirectPage, redirectPages } from 'ui-router-server/prerender';
 *
 * declare const analytics: string;
 *
 * const rules = redirectPages({
 *   page: (line) => redirectPage(line).replace('</head>', `${analytics}</head>`),
 * });
 * ```
 */
export const redirectPage = ({ to }: RedirectLine): string => {
  const href = escapeHtml(to);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Redirecting to ${href}</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${href}">
<script>
var u = new URL(${scriptString(to)}, location.href);
if (!u.search) u.search = location.search;
if (!u.hash) u.hash = location.hash;
location.replace(u.href);
</script>
<meta http-equiv="refresh" content="0; url=${href}">
</head>
<body>
<p>Moved to <a href="${href}">${href}</a>.</p>
</body>
</html>
`;
};

const trimSlashes = (path: string): string =>
  path.replace(/^\/+/, '').replace(/\/+$/, '');

// The page's file under outDir; throws for a line no page can answer.
const pageFileFor = (from: string, base: string): string => {
  if (/[*?#]|\/:/.test(from))
    throw new Error(
      `redirectPages: '${from}' is a pattern, not a path; a page can't answer it`,
    );
  const prefix = trimSlashes(base);
  const path = trimSlashes(from);

  if (prefix !== '' && path !== prefix && !path.startsWith(`${prefix}/`))
    throw new Error(`redirectPages: '${from}' lies outside base '${base}'`);
  const rest = trimSlashes(path.slice(prefix.length));

  return rest === '' ? 'index.html' : `${rest}/index.html`;
};

// A line between a path's two spellings, whose page would be its target's.
const isRespelling = ({ from, to }: RedirectLine): boolean =>
  trimSlashes(from) === trimSlashes(to);

const joinPath = (dir: string, file: string): string =>
  dir === '' ? file : `${dir.replace(/\/+$/, '')}/${file}`;

/**
 * A {@link PrerenderOptions.rules | `rules`} writer for static hosts with no
 * redirect rules, such as GitHub Pages or a plain bucket: each line becomes
 * a page at `<from>/index.html` that sends the browser to its `to`. The page
 * answers 200, so the line's status never reaches the host; its canonical
 * link tells search engines the content moved.
 *
 * The first line for a page wins, as in `_redirects`, so a path's two
 * spellings share one page. A line between a path's two spellings, as a
 * mount's trailing-slash policy adds, writes nothing: its page would be its
 * target's own, and the host serves that at both spellings.
 *
 * @param options - the base `outDir` is served at, whether to write `_redirects` too, and the page template
 * @returns the writer to pass as `rules`
 * @throws an `Error`, when the writer runs, for a line whose page would replace one `prerender` wrote
 * @throws an `Error`, when the writer runs, for a line whose `from` is a pattern or lies outside `base`
 *
 * @example
 * ```ts
 * import {
 *   prerender,
 *   type PrerenderOptions,
 *   redirectPages,
 * } from 'ui-router-server/prerender';
 *
 * declare const { mounts, paths, render, write }: PrerenderOptions;
 *
 * await prerender({ mounts, outDir: 'dist', paths, render, write, rules: redirectPages() });
 * ```
 */
export const redirectPages =
  (options: RedirectPagesOptions = {}): RulesWriter =>
  async (lines, { write, outDir, pages }) => {
    const { base = '/', redirectsFile = false, page = redirectPage } = options;
    const written = new Set(pages.map((page) => page.file));
    const planned = new Map<string, RedirectLine>();

    for (const line of lines) {
      const file = pageFileFor(line.from, base);

      if (isRespelling(line)) continue;

      if (written.has(file))
        throw new Error(
          `redirectPages: '${line.from}' redirects, but prerender wrote a page at '${file}'`,
        );

      if (!planned.has(file)) planned.set(file, line);
    }

    for (const [file, line] of planned)
      await write(joinPath(outDir, file), await page(line));

    if (redirectsFile && lines.length > 0)
      await write(joinPath(outDir, '_redirects'), redirectsFileBody(lines));
  };
