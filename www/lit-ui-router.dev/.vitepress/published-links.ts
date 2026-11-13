import { globSync, readdirSync, readFileSync } from 'node:fs';
import { join, matchesGlob, relative } from 'node:path';

import { readManifest } from '@tools/bootstrap/manifest.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { mounts as appMounts } from 'sample-app-routes';
import { createServerRouter } from 'ui-router-server';
import * as v from 'valibot';
import { createMarkdownRenderer, type MarkdownRenderer } from 'vitepress';

import { PACKAGES } from '../catalog/packages.ts';
import { REDIRECTS } from '../catalog/redirects.ts';
import { mounts as releaseMounts } from '../worker/releases/routes.ts';
import { changelogAnchors } from './changelog.ts';
import { matchRedirect, redirectLines } from './redirects.ts';
import { surfaceOf } from './surfaces.ts';

/** The origin package READMEs, manifests and doc comments link. */
export const ORIGIN = 'https://lit-ui-router.dev';

const SITE = join(import.meta.dirname, '..');

/** A site URL in Markdown, HTML, JSON or a doc comment, up to the first delimiter. */
const SITE_URL =
  /https:\/\/lit-ui-router\.dev(?![\w-]|\.\w)[^\s"'`<>()[\]{}|]*/g;

/** Every site URL in a text, without trailing sentence punctuation. */
export const siteUrls = (text: string): string[] =>
  [...text.matchAll(SITE_URL)].map(([url]) => url.replace(/[.,;:!?]+$/, ''));

/** A site link that ships in a package's tarball. */
export interface PackageLink {
  name: string;
  /** Repo-relative file the link is in. */
  file: string;
  url: string;
}

/** The tracked sources a `files` list ships besides dist/, which is built from them. */
const shippedSources = (dir: string, files: readonly string[]): string[] => {
  const include = files.filter(
    (glob) => !glob.startsWith('!') && !glob.startsWith('dist/'),
  );

  const exclude = files.flatMap((glob) =>
    glob.startsWith('!') ? [glob.slice(1)] : [],
  );

  return include
    .flatMap((glob) => globSync(glob, { cwd: dir, withFileTypes: true }))
    .flatMap((entry) =>
      entry.isFile() ? [relative(dir, join(entry.parentPath, entry.name))] : [],
    )
    .filter((file) => !exclude.some((glob) => matchesGlob(file, glob)));
};

/** Site links in every published package's README, manifest and shipped sources. */
export function packageLinks(): PackageLink[] {
  const packages = join(workspaceRoot, 'packages');

  return readdirSync(packages).flatMap((entry) => {
    const dir = join(packages, entry);
    const manifest = readManifest(dir);

    if (!manifest?.name || manifest.private) return [];

    const { name } = manifest;

    // SAFETY: PackageManifest leaves `files` out; npm defines it as a list of globs
    const { files = [] } = manifest as { files?: string[] };

    const sources = [
      ...readdirSync(dir).filter((file) => /^readme\.md$/i.test(file)),
      'package.json',
      ...shippedSources(dir, files),
    ];

    return sources.flatMap((file) =>
      siteUrls(readFileSync(join(dir, file), 'utf8')).map((url) => ({
        name,
        file: `packages/${entry}/${file}`,
        url,
      })),
    );
  });
}

const PublishedUrl = v.pipe(
  v.string(),
  v.transform((line) => line.split(' ')),
  v.tuple([
    v.pipe(v.string(), v.regex(/^\/[^#]*(?:#.+)?$/)),
    v.pipe(
      v.string(),
      v.transform((names) => names.split(',')),
      v.array(v.picklist(PACKAGES.map(({ name }) => name))),
    ),
  ]),
  v.transform(([path, packages]) => ({ path, packages })),
);

/** A catalog entry: a path, with the fragment when the link carries one, and the packages that link it. */
export type PublishedUrl = v.InferOutput<typeof PublishedUrl>;

/** Each path a released tarball links, with the packages that link it: `<path>[#<fragment>] <name>,<name>` per line. */
export const publishedUrls = (): PublishedUrl[] =>
  readFileSync(join(SITE, 'catalog/published-urls.txt'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => v.parse(PublishedUrl, line));

/** The `<path>[#<fragment>] <name>` lines package links need that the entries lack; a fragment is its own entry. */
export function unlistedLinks(
  links: readonly Pick<PackageLink, 'name' | 'url'>[],
  entries: readonly PublishedUrl[],
): string[] {
  const listed = new Set(
    entries.flatMap(({ path, packages }) =>
      packages.map((name) => `${path} ${name}`),
    ),
  );

  return [
    ...new Set(
      links.flatMap(({ name, url }) => {
        const { pathname, hash } = new URL(url);
        const line = `${pathname}${hash} ${name}`;

        return listed.has(line) ? [] : [line];
      }),
    ),
  ];
}

/** True when the path names a file under the site root at exactly this spelling: macOS disks ignore case, Cloudflare does not. */
const exactFile = (relative: string): boolean =>
  relative.split('/').every((part, index, parts) => {
    const entry = readdirSync(join(SITE, ...parts.slice(0, index)), {
      withFileTypes: true,
    }).find(({ name }) => name === part);

    return index === parts.length - 1
      ? entry?.isFile() === true
      : entry?.isDirectory() === true;
  });

/** The Markdown source VitePress builds a path from, under cleanUrls. */
const pageSource = (path: string): string | undefined => {
  const page = decodeURIComponent(path).slice(1);

  const candidates =
    page.endsWith('/') || page === ''
      ? [`${page}index.md`]
      : [`${page}.md`, `${page}/index.md`];

  return candidates.find(exactFile);
};

let renderer: Promise<MarkdownRenderer> | undefined;

const anchorCache = new Map<string, Set<string>>();

/** The heading ids VitePress gives a page source. */
async function anchors(source: string): Promise<Set<string>> {
  const cached = anchorCache.get(source);

  if (cached) return cached;

  renderer ??= createMarkdownRenderer(SITE);

  const tokens = (await renderer).parse(
    readFileSync(join(SITE, source), 'utf8'),
    {},
  );

  const ids = new Set(
    tokens.flatMap((token) => {
      const id = token.type === 'heading_open' && token.attrGet('id');

      return id ? [id] : [];
    }),
  );

  anchorCache.set(source, ids);

  return ids;
}

const router = createServerRouter({
  mounts: { ...appMounts, ...releaseMounts },
});

/** Why a worker path is no page: the router has no route for it, or answers its shell with a 404. */
async function workerProblem(path: string): Promise<string | undefined> {
  const verdict = await router.resolve(new URL(path, ORIGIN));

  if (verdict.kind === 'notFound') return 'the worker has no route';

  return verdict.kind === 'shell' && verdict.status === 404
    ? 'the worker answers 404'
    : undefined;
}

/** Why a page path is no page: no source, or no heading for its fragment. */
async function pageProblem(
  path: string,
  fragment: string,
): Promise<string | undefined> {
  const changelog = changelogAnchors(decodeURIComponent(path));

  if (changelog) {
    return !fragment || changelog.has(fragment)
      ? undefined
      : `no section #${fragment} in the changelog`;
  }

  const source = pageSource(path);

  if (!source) {
    if (exactFile(`public${decodeURIComponent(path)}`)) return undefined;

    return surfaceOf(path).renderer === 'typedoc'
      ? 'no generated reference page (docs:api writes them)'
      : 'no page source';
  }

  if (!fragment || (await anchors(source)).has(fragment)) return undefined;

  return `no heading #${fragment} in ${source}`;
}

/** Why a path is nothing its surface serves. */
async function targetProblem(
  path: string,
  fragment: string,
): Promise<string | undefined> {
  const { renderer } = surfaceOf(path);

  if (renderer === 'worker') return workerProblem(path);

  if (renderer === 'vitepress' || renderer === 'typedoc')
    return pageProblem(path, fragment);

  return exactFile(`public${decodeURIComponent(path)}`)
    ? undefined
    : 'no file in public/';
}

/** Why a site URL resolves to nothing the site serves, through at most one redirect; `undefined` when it resolves. */
export async function linkProblem(url: string): Promise<string | undefined> {
  const { origin, pathname, hash } = new URL(url);

  if (origin !== ORIGIN) return `${url}: not on ${ORIGIN}`;

  const redirect = matchRedirect(redirectLines(REDIRECTS), pathname);
  const target = redirect ? redirect.location.split(/[?#]/)[0] : pathname;
  const fragment = decodeURIComponent(hash.slice(1));

  const problem = await targetProblem(target, fragment);

  if (!problem) return undefined;

  return redirect ? `${url} -> ${target}: ${problem}` : `${url}: ${problem}`;
}

/** Why each catalog entry no longer resolves; a fragment entry checks its page and the heading. */
export const entryProblems = async (
  entries: readonly PublishedUrl[],
): Promise<string[]> =>
  (
    await Promise.all(
      entries.map(({ path }) => linkProblem(`${ORIGIN}${path}`)),
    )
  ).flatMap((problem) => (problem ? [problem] : []));
