import { existsSync, globSync } from 'node:fs';
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RedirectLine } from 'ui-router-server/prerender';

import { SURFACES } from '../catalog/surfaces.ts';
import { matchRedirect, servedFiles } from './redirects.ts';
import { SITE_ORIGIN, type VersionManifest } from './versions.ts';

/** The tag each frozen snapshot is built from, keyed by version id. */
export const SNAPSHOT_TAGS = {
  v1: 'lit-ui-router@1.20.0',
} as const satisfies Readonly<Record<string, string>>;

/** A version id with a snapshot tag. */
export const hasSnapshotTag = (id: string): id is keyof typeof SNAPSHOT_TAGS =>
  Object.hasOwn(SNAPSHOT_TAGS, id);

/** Where `scripts/docs-snapshot.ts` writes each snapshot's built output, one directory per version id. */
export const SNAPSHOTS_DIR = join(import.meta.dirname, '..', 'snapshots');

/** The worker's mounts: a snapshot serves none of them, so its links into them go to the main site's. */
export const WORKER_MOUNTS: readonly string[] = SURFACES.flatMap(
  ({ renderer, paths }) =>
    renderer === 'worker' ? paths.filter((path) => !path.includes('*')) : [],
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

/** The latest page a snapshot page points its canonical at: the same path, else where the main site moved it, else the home page. */
export function canonicalPath(
  path: string,
  outDir: string,
  redirects: readonly RedirectLine[],
): string {
  const served = (candidate: string) =>
    servedFiles(outDir, candidate).some((file) => existsSync(file));

  if (served(path)) return path;

  const moved = matchRedirect(redirects, path)?.location.split(/[?#]/)[0];

  return moved && served(moved) ? moved : '/';
}

const CANONICAL = /<link rel="canonical"[^>]*>\n?/g;

/** A page with its canonical link set to `href`, replacing any earlier one. */
export const withCanonical = (html: string, href: string): string =>
  html
    .replace(CANONICAL, '')
    .replace('</head>', `<link rel="canonical" href="${href}">\n</head>`);

/** The manifest's non-current versions, each with its snapshot directory and its path in the build output. */
export const snapshotsOf = (manifest: VersionManifest) =>
  manifest.others.map((version) => ({
    version,
    source: join(SNAPSHOTS_DIR, version.id),
    target: version.path.slice(1),
  }));

/**
 * The build's copy step: puts each non-current version's snapshot under its path in `outDir`, and
 * points every page's canonical at its latest counterpart in this build. Main moves on after a
 * freeze, so the canonical is resolved here rather than stored.
 */
export async function copySnapshots(
  manifest: VersionManifest,
  outDir: string,
  redirects: readonly RedirectLine[],
): Promise<void> {
  for (const { version, source, target } of snapshotsOf(manifest)) {
    if (!existsSync(join(source, 'index.html')))
      throw new Error(
        `versions.json lists ${version.id} at ${version.path}, but ${source} holds no snapshot: run scripts/docs-snapshot.ts ${version.id}`,
      );

    const dir = join(outDir, target);

    await rm(dir, { recursive: true, force: true });
    await cp(source, dir, { recursive: true });

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
