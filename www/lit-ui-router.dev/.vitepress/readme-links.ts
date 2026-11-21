import { join, relative } from 'node:path';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import type { MarkdownEnv, MarkdownRenderer } from 'vitepress';

import { REDIRECTS } from '../catalog/redirects.ts';
import { matchRedirect, redirectLines } from './redirects.ts';
import { surfaceOf } from './surfaces.ts';
import { SITE_ORIGIN } from './versions.ts';

const SITE = join(import.meta.dirname, '..');

/** Where a repo file that is no page on this site is read. */
export const REPO_FILE_URL =
  'https://github.com/simshanith/lit-ui-router/blob/main';

// VitePress wraps an included Markdown file in these, naming the file's directory.
const INCLUDE_MARKER = /^[ \t]*<!-- @include-(?:start: (.*)|end) -->[ \t]*$/gm;

/** A URL that names neither a scheme, a root path nor a fragment of its own page. */
const RELATIVE = /^(?![a-z][a-z\d+.-]*:|\/|#)/i;

const includeStacks = new WeakMap<MarkdownEnv, string[]>();

const redirects = redirectLines(REDIRECTS);

/** A site URL as a root path, flagged when VitePress's client router has no page for it. */
function sitePath(url: string): { path: string; reload: boolean } | undefined {
  if (!url.startsWith(SITE_ORIGIN)) return undefined;

  const rest = url.slice(SITE_ORIGIN.length);

  // lit-ui-router.dev.example.com is another origin
  if (rest && !/^[/?#]/.test(rest)) return undefined;

  const path = rest.startsWith('/') ? rest : `/${rest}`;
  const pathname = path.split(/[?#]/)[0] ?? '/';
  const { renderer } = surfaceOf(pathname);

  // The worker, a static file and a redirect each answer a request, not the client router.
  const reload =
    renderer === 'worker' ||
    renderer === 'static' ||
    Boolean(matchRedirect(redirects, pathname));

  return { path, reload };
}

/** True for a relative URL in a file included from outside the site. */
const leavesSite = (dir: string | undefined, url: string): dir is string =>
  dir !== undefined &&
  RELATIVE.test(url) &&
  relative(SITE, dir).startsWith('..');

/** A relative link out of a file included from outside the site, as that file's URL in the repository. */
function repoUrl(dir: string | undefined, url: string): string | undefined {
  if (!leavesSite(dir, url)) return undefined;

  const [, path = '', rest = ''] = /^([^?#]*)(.*)$/.exec(url) ?? [];

  return `${REPO_FILE_URL}/${relative(workspaceRoot, join(dir, path))}${rest}`;
}

/**
 * Makes a README's links work on the page that includes it: a link to this
 * site becomes an in-site link, a relative link that only resolves in the
 * repository points at the repository, and a relative image is bundled from
 * beside the README.
 */
export function readmeLinks(md: MarkdownRenderer): void {
  const htmlBlock = md.renderer.rules.html_block;
  const linkOpen = md.renderer.rules.link_open;
  const image = md.renderer.rules.image;

  if (!htmlBlock || !linkOpen || !image)
    throw new Error('readmeLinks: VitePress registers these rules');

  // Before VitePress's own rule consumes the markers.
  md.renderer.rules.html_block = (tokens, idx, options, env, self) => {
    // SAFETY: VitePress renders every page with a MarkdownEnv
    const mdEnv = env as MarkdownEnv;

    for (const [, dir] of (tokens[idx]?.content ?? '').matchAll(
      INCLUDE_MARKER,
    )) {
      const stack = includeStacks.get(mdEnv) ?? [];

      includeStacks.set(mdEnv, stack);

      if (dir === undefined) stack.pop();
      else stack.push(dir);
    }

    return htmlBlock(tokens, idx, options, env, self);
  };

  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const src = token?.attrGet('src');

    // VitePress rebases only a `./` or `../` source against the included file.
    if (
      token &&
      src &&
      !src.startsWith('.') &&
      // SAFETY: as for html_block
      leavesSite(includeStacks.get(env as MarkdownEnv)?.at(-1), src)
    )
      token.attrSet('src', `./${src}`);

    return image(tokens, idx, options, env, self);
  };

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const href = token?.attrGet('href');

    if (token && href) {
      // SAFETY: as for html_block
      const dir = includeStacks.get(env as MarkdownEnv)?.at(-1);
      const site = sitePath(href);

      if (site) {
        token.attrSet('href', site.path);

        if (site.reload && token.attrIndex('target') < 0)
          token.attrSet('target', '_self');
      } else {
        const repo = repoUrl(dir, href);

        if (repo) token.attrSet('href', repo);
      }
    }

    return linkOpen(tokens, idx, options, env, self);
  };
}
