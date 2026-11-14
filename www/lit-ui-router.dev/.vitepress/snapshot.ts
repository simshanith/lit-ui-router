import { createHash } from 'node:crypto';
import { existsSync, globSync, readFileSync, statSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RedirectLine } from 'ui-router-server/prerender';
import * as v from 'valibot';

import { SURFACES } from '../catalog/surfaces.ts';
import {
  isDynamic,
  matchRedirect,
  redirectsFileBody,
  servedFiles,
} from './redirects.ts';
import { SITE_ORIGIN, type VersionManifest } from './versions.ts';

/** The tag each frozen snapshot is built from, keyed by version id. */
export const SNAPSHOT_TAGS = {
  v1: 'lit-ui-router@1.20.0',
} as const satisfies Readonly<Record<string, string>>;

/** A version id with a snapshot tag. */
export const hasSnapshotTag = (id: string): id is keyof typeof SNAPSHOT_TAGS =>
  Object.hasOwn(SNAPSHOT_TAGS, id);

/** The `www/` package that holds a snapshot's Worker config and, gitignored, its built assets. */
export const snapshotPackage = (id: string): string =>
  `www/${id}.versions.lit-ui-router.dev`;

/** A snapshot surface's row: a frozen version's whole prefix, handed to that version's Worker. */
const isSnapshotRow = (id: string): boolean => id.startsWith('snapshot-');

/** The worker's mounts: a snapshot serves none of them, so its links into them go to the main site's. */
export const WORKER_MOUNTS: readonly string[] = SURFACES.flatMap(
  ({ id, renderer, paths }) =>
    renderer === 'worker' && !isSnapshotRow(id)
      ? paths.filter((path) => !path.includes('*'))
      : [],
);

/** Built files a snapshot drops: the root serves the live copies, and the worker serves the mounts. */
export const PRUNED = [
  '_headers',
  '_redirects',
  'robots.txt',
  'sitemap.xml',
  'sitemap-pages.xml',
  'versions.json',
  'release-pages.css',
  'release-diff.js',
  'assets/release-diff',
  ...WORKER_MOUNTS.flatMap((mount) => [
    `${mount.slice(1)}.html`,
    mount.slice(1),
  ]),
] as const;

const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Longest first, so `/app` never claims `/app-mobx`.
const mountAlternation = [...WORKER_MOUNTS]
  .sort((a, b) => b.length - a.length)
  .map((mount) => escapeRegExp(mount.slice(1)))
  .join('|');

/** Drops the snapshot base from links into the worker's mounts, in HTML attributes and JS string literals alike. */
export function unversionWorkerLinks(text: string, base: string): string {
  const pattern = new RegExp(
    `(["'\`])${escapeRegExp(base)}(${mountAlternation})(?=[/"'\`?#\\\\])`,
    'g',
  );

  return text.replace(pattern, '$1/$2');
}

/** Moves links to the built examples under the base: the embeds were built at `/examples/<name>/`, and the main site's now show later code. */
export function versionExampleLinks(
  text: string,
  base: string,
  names: readonly string[],
): string {
  if (names.length === 0) return text;

  const pattern = new RegExp(
    `(["'\`(])/examples/(${names.map(escapeRegExp).join('|')})/`,
    'g',
  );

  return text.replace(pattern, `$1${base}examples/$2/`);
}

/** The built examples in a snapshot: each directory under examples/ with its own index.html. */
export const builtExamples = (dir: string): string[] =>
  globSync('examples/*/index.html', { cwd: dir })
    .map((file) => file.split('/')[1] ?? '')
    .sort();

/** A snapshot's llms.txt: its page URLs moved under the base, the worker's left at the root, and a note naming the latest. */
export function snapshotLlmsTxt(
  text: string,
  base: string,
  label: string,
): string {
  const pattern = new RegExp(
    `${escapeRegExp(SITE_ORIGIN)}/(?!(?:${mountAlternation})(?:[/)?#\\s]|$))`,
    'g',
  );

  const moved = text.replace(pattern, `${SITE_ORIGIN}${base}`);

  const note = `> These are the ${label} docs, kept as they were at their last release. The latest docs are at ${SITE_ORIGIN}/llms.txt.\n`;

  return moved.replace(/\n\n/, `\n\n${note}\n`);
}

/** VitePress stamps every page it renders; built examples and other copied HTML carry no stamp. */
const VITEPRESS_PAGE = '<meta name="generator" content="VitePress ';

/** The snapshot's VitePress pages, relative to its root. */
export async function snapshotPages(dir: string): Promise<string[]> {
  const pages: string[] = [];

  for (const file of globSync('**/*.html', { cwd: dir })) {
    if ((await readFile(join(dir, file), 'utf8')).includes(VITEPRESS_PAGE))
      pages.push(file);
  }

  return pages.sort();
}

/** A page file's clean URL path: `guides/index.html` is `/guides/`. */
export const htmlPath = (file: string): string =>
  `/${file.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '')}`;

/** Finishes a fresh build in place: drops the pruned files, sends its links into the worker's mounts to the root, and keeps its embeds on its own examples. */
export async function finishSnapshot(
  dir: string,
  base: string,
  label: string,
  sampleAppAssets: readonly string[],
): Promise<void> {
  for (const path of [
    ...PRUNED,
    ...sampleAppAssets.map((name) => `assets/${name}`),
  ])
    await rm(join(dir, path), { recursive: true, force: true });

  const examples = builtExamples(dir);

  for (const file of globSync('**/*.{html,js,css}', { cwd: dir })) {
    const path = join(dir, file);
    const text = await readFile(path, 'utf8');

    const next = versionExampleLinks(
      unversionWorkerLinks(text, base),
      base,
      examples,
    );

    if (next !== text) await writeFile(path, next);
  }

  for (const file of ['llms.txt', 'llms-full.txt']) {
    const path = join(dir, file);

    if (existsSync(path))
      await writeFile(
        path,
        snapshotLlmsTxt(await readFile(path, 'utf8'), base, label),
      );
  }
}

/** Whether a built site answers the path, as html_handling resolves it. */
const isServed = (outDir: string, path: string): boolean =>
  servedFiles(outDir, path).some((file) => existsSync(file));

/** The latest page a snapshot page points its canonical at: the same path, else where the main site moved it, else the home page. */
export function canonicalPath(
  path: string,
  outDir: string,
  redirects: readonly RedirectLine[],
): string {
  if (isServed(outDir, path)) return path;

  const moved = matchRedirect(redirects, path)?.location.split(/[?#]/)[0];

  return moved && isServed(outDir, moved) ? moved : '/';
}

const CANONICAL = /<link rel="canonical"[^>]*>\n?/g;

/** A page with its canonical link set to `href`, replacing any earlier one. */
export const withCanonical = (html: string, href: string): string =>
  html
    .replace(CANONICAL, '')
    .replace('</head>', `<link rel="canonical" href="${href}">\n</head>`);

/** The canonical link `withCanonical` wrote, read back as a path on the main site. */
export function canonicalOf(html: string): string | undefined {
  const href = /<link rel="canonical" href="([^"]+)">/.exec(html)?.[1];

  return href?.startsWith(SITE_ORIGIN)
    ? href.slice(SITE_ORIGIN.length)
    : undefined;
}

/**
 * Points every page of a finished snapshot at its latest counterpart, resolved against the main
 * site's build in `outDir`. The 404 page has none. Run again, it replaces the earlier links.
 */
export async function bakeCanonicals(
  dir: string,
  outDir: string,
  redirects: readonly RedirectLine[],
): Promise<void> {
  for (const file of await snapshotPages(dir)) {
    if (file === '404.html') continue;
    const path = join(dir, file);
    const latest = canonicalPath(htmlPath(file), outDir, redirects);

    await writeFile(
      path,
      withCanonical(await readFile(path, 'utf8'), `${SITE_ORIGIN}${latest}`),
    );
  }
}

/** The snapshot's paths under the worker's mounts, sent to the mounts: its client renders some nav links with its base. */
export const snapshotRedirects = (base: string): RedirectLine[] =>
  SURFACES.flatMap(({ id, renderer, paths }) =>
    renderer === 'worker' && !isSnapshotRow(id)
      ? paths.map((path) => ({
          from: `${base}${path.slice(1)}`,
          to: path.replace(/\*$/, ':splat'),
          status: 301,
        }))
      : [],
  );

/** The main site's `_headers` moved under the base: each rule's path and each `Link` target. */
export const snapshotHeaders = (text: string, base: string): string =>
  text
    .replace(/^\/(\S*)$/gm, `${base}$1`)
    .replace(/<\/([^>]*)>/g, `<${base}$1>`);

/** Writes the snapshot Worker's `_redirects` and `_headers` at its assets root, beside the `base` folder. */
export async function writeSnapshotRules(
  root: string,
  base: string,
  headers: string,
): Promise<void> {
  const redirects = snapshotRedirects(base);

  await writeFile(
    join(root, '_redirects'),
    redirectsFileBody([
      ...redirects.filter((rule) => !isDynamic(rule)),
      ...redirects.filter(isDynamic),
    ]),
  );
  await writeFile(join(root, '_headers'), snapshotHeaders(headers, base));
}

/** The record of a deployed snapshot that the repo keeps instead of its files. */
export const SnapshotManifest = v.object({
  tag: v.pipe(v.string(), v.nonEmpty()),
  files: v.pipe(v.number(), v.integer()),
  bytes: v.pipe(v.number(), v.integer()),
  /** sha256 of the `sha256sum` listing of every file under the assets root, sorted by path. */
  sha256: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
  /** Each snapshot page's path, mapped to the main-site path its canonical link names. */
  pages: v.record(v.string(), v.string()),
});

export type SnapshotManifest = v.InferOutput<typeof SnapshotManifest>;

/** Where the repo keeps a version's snapshot manifest. */
export const manifestPath = (id: string): string =>
  join(import.meta.dirname, '..', 'catalog', 'snapshots', `${id}.json`);

/** A version's committed snapshot manifest. */
export const readSnapshotManifest = (id: string): SnapshotManifest =>
  v.parse(SnapshotManifest, JSON.parse(readFileSync(manifestPath(id), 'utf8')));

/** The file count, byte total and digest of an assets root. */
export function snapshotDigest(
  root: string,
): Pick<SnapshotManifest, 'files' | 'bytes' | 'sha256'> {
  const files = globSync('**/*', { cwd: root })
    .filter((file) => statSync(join(root, file)).isFile())
    .sort();

  const listing = files
    .map(
      (file) =>
        `${createHash('sha256')
          .update(readFileSync(join(root, file)))
          .digest('hex')}  ${file}\n`,
    )
    .join('');

  return {
    files: files.length,
    bytes: files.reduce(
      (sum, file) => sum + statSync(join(root, file)).size,
      0,
    ),
    sha256: createHash('sha256').update(listing).digest('hex'),
  };
}

/** Canonical targets the main build in `outDir` neither serves nor redirects: a moved page owes a redirect. */
export function canonicalProblems(
  manifest: SnapshotManifest,
  outDir: string,
  redirects: readonly RedirectLine[],
): string[] {
  return Object.entries(manifest.pages).flatMap(([page, target]) =>
    isServed(outDir, target) || matchRedirect(redirects, target)
      ? []
      : [`${page}: its canonical ${target} is neither served nor redirected`],
  );
}

/** The main build's indexes that must not list a snapshot page. */
export const MAIN_INDEXES = [
  'sitemap-pages.xml',
  'llms.txt',
  'llms-full.txt',
] as const;

/** Indexes in `outDir` that name a URL under one of the manifest's other versions. */
export async function indexProblems(
  manifest: VersionManifest,
  outDir: string,
): Promise<string[]> {
  const problems: string[] = [];

  for (const file of MAIN_INDEXES) {
    const text = await readFile(join(outDir, file), 'utf8');

    for (const { path } of manifest.others) {
      if (text.includes(`${SITE_ORIGIN}${path}`))
        problems.push(`${file}: lists ${SITE_ORIGIN}${path}`);
    }
  }

  return problems;
}
