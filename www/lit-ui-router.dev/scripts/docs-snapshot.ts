#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  globSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, relative } from 'node:path';

import { workspaceRoot } from '@tools/bootstrap/root.ts';

import { REDIRECTS } from '../catalog/redirects.ts';
import { redirectLines } from '../.vitepress/redirects.ts';
import {
  bakeCanonicals,
  canonicalProblems,
  finishSnapshot,
  hasSnapshotTag,
  isLiveSnapshot,
  snapshotCanonicals,
  snapshotDigest,
  snapshotNote,
  snapshotPackage,
  snapshotPages,
  SNAPSHOT_TAGS,
  writeSnapshotRules,
} from '../.vitepress/snapshot.ts';
import { bannerKind, BUNDLED_MANIFEST } from '../.vitepress/versions.ts';

// Builds a docs snapshot: the whole site under its version's base, into the assets directory of
// that version's Worker package (www/<id>.versions.lit-ui-router.dev/dist/). A version with a
// snapshot tag is built at that tag in a throwaway worktree; a live one (LIVE_SNAPSHOTS) is built
// from this checkout.
// Usage: docs-snapshot.ts [version-id] [--bake-only], default v1. --bake-only skips the site build
// and redoes the last step on the snapshot already there: its canonical links, _redirects and
// _headers. That step reads this checkout's built site, so build it first.

const SITE = 'www/lit-ui-router.dev';

const PACKAGE = join(import.meta.dirname, '..');

/** The version mechanism the tag predates, carried into its checkout so the snapshot renders the banner and menu. */
const VERSION_FILES = [
  '.vitepress/versions.ts',
  '.vitepress/theme/use-versions.ts',
  '.vitepress/theme/components/VersionBanner.vue',
  '.vitepress/theme/components/VersionMenu.vue',
  'public/versions.json',
] as const;

/** Text edits that register the copied components, each of which must match once. */
const VERSION_EDITS: readonly (readonly [
  file: string,
  from: string,
  to: string,
])[] = [
  [
    '.vitepress/theme/index.ts',
    "import ReleaseDiffPicker from './components/ReleaseDiffPicker.vue';\n",
    "import ReleaseDiffPicker from './components/ReleaseDiffPicker.vue';\nimport VersionBanner from './components/VersionBanner.vue';\nimport VersionMenu from './components/VersionMenu.vue';\n",
  ],
  [
    '.vitepress/theme/index.ts',
    "      'not-found':",
    "      'layout-top': () => h(VersionBanner),\n      'not-found':",
  ],
  [
    '.vitepress/theme/index.ts',
    "    app.component('ReleaseDiffPicker', ReleaseDiffPicker);\n",
    "    app.component('ReleaseDiffPicker', ReleaseDiffPicker);\n    app.component('VersionMenu', VersionMenu);\n",
  ],
  [
    '.vitepress/config.ts',
    '    nav: NAV,\n',
    "    nav: [...NAV, { component: 'VersionMenu' }],\n",
  ],
];

const run = (cwd: string, command: string, args: readonly string[]): void => {
  console.log(`$ ${command} ${args.join(' ')}`);
  execFileSync(command, args, { cwd, stdio: 'inherit' });
};

/** Copies the version mechanism into the tag's site and registers it, unless the tag already has it. */
function overlayVersions(site: string): void {
  const theme = join(site, '.vitepress/theme/index.ts');

  if (readFileSync(theme, 'utf8').includes('VersionBanner')) return;

  for (const file of VERSION_FILES)
    copyFileSync(join(PACKAGE, file), join(site, file));

  for (const [file, from, to] of VERSION_EDITS) {
    const path = join(site, file);
    const text = readFileSync(path, 'utf8');

    if (text.split(from).length !== 2)
      throw new Error(`${file}: expected one ${JSON.stringify(from)}`);
    writeFileSync(path, text.replace(from, to));
  }
}

/** The sample apps' bundles the site copies into assets/; the snapshot links the main site's apps instead. */
const sampleAppAssets = (site: string): string[] =>
  globSync('node_modules/sample-app-lit-*/dist/**/assets/*', { cwd: site }).map(
    (file) => basename(file),
  );

/** Finishes the build in `out` and moves it to `target`, replacing what was there. */
async function place(
  out: string,
  site: string,
  path: string,
  note: string,
  target: string,
): Promise<void> {
  await finishSnapshot(out, path, note, sampleAppAssets(site));

  if (!(await snapshotPages(out)).includes('index.html'))
    throw new Error(`${out}: no index.html`);

  await rm(target, { recursive: true, force: true });
  await mkdir(join(target, '..'), { recursive: true });
  await cp(out, target, { recursive: true });
}

/** Builds this checkout's site under the version's base into `target`, finished but without canonical links. */
async function buildHere(
  path: string,
  note: string,
  target: string,
): Promise<void> {
  const out = await mkdtemp(join(tmpdir(), 'docs-snapshot-'));

  try {
    run(PACKAGE, 'pnpm', [
      'exec',
      'vitepress',
      'build',
      '.',
      '--base',
      path,
      '--outDir',
      out,
    ]);
    await place(out, PACKAGE, path, note, target);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}

/** Builds the tag's site under the version's base into `target`, finished but without canonical links. */
async function buildAtTag(
  tag: string,
  path: string,
  note: string,
  target: string,
): Promise<void> {
  const checkout = mkdtempSync(join(tmpdir(), 'docs-snapshot-'));
  const out = join(checkout, 'snapshot-out');
  const site = join(checkout, SITE);

  // Outside the try: a failed add registers no worktree for the cleanup to remove.
  run(workspaceRoot, 'git', [
    'worktree',
    'add',
    '--detach',
    checkout,
    `${tag}^{commit}`,
  ]);

  try {
    overlayVersions(site);
    run(checkout, 'mise', ['trust', '--quiet']);
    run(checkout, 'mise', ['install']);
    run(checkout, 'mise', ['run', 'setup']);
    // The site's dependencies and generated pages; the base-path build below reruns only VitePress.
    run(checkout, 'mise', [
      'exec',
      '--',
      'turbo',
      'run',
      'build',
      '--filter=@www/lit-ui-router.dev',
    ]);
    run(site, 'mise', [
      'exec',
      '--',
      'pnpm',
      'exec',
      'vitepress',
      'build',
      '.',
      '--base',
      path,
      '--outDir',
      out,
    ]);
    await place(out, site, path, note, target);
  } finally {
    run(workspaceRoot, 'git', ['worktree', 'remove', '--force', checkout]);
  }
}

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const bakeOnly = args.includes('--bake-only');
  const id = args.find((arg) => !arg.startsWith('--')) ?? 'v1';
  const tag = hasSnapshotTag(id) ? SNAPSHOT_TAGS[id] : undefined;
  const version = BUNDLED_MANIFEST.others.find((other) => other.id === id);

  if (!version || (!tag && !isLiveSnapshot(id))) {
    console.error(
      `docs-snapshot.ts: no versions.json entry, or neither a snapshot tag nor a live snapshot, for ${id}`,
    );
    process.exitCode = 2;

    return;
  }

  const mainBuild = join(PACKAGE, 'dist');

  if (!existsSync(join(mainBuild, 'index.html'))) {
    console.error(
      `docs-snapshot.ts: ${relative(workspaceRoot, mainBuild)} holds no build to resolve canonical links against: run turbo run build --filter=@www/lit-ui-router.dev`,
    );
    process.exitCode = 2;

    return;
  }

  const root = join(workspaceRoot, snapshotPackage(id), 'dist');
  const target = join(root, id);

  const note = snapshotNote(
    version.label,
    bannerKind(BUNDLED_MANIFEST, version),
  );

  if (!bakeOnly) {
    await (tag
      ? buildAtTag(tag, version.path, note, target)
      : buildHere(version.path, note, target));
  }

  if (!existsSync(join(target, 'index.html'))) {
    console.error(
      `docs-snapshot.ts: ${relative(workspaceRoot, target)} holds no snapshot to bake: run without --bake-only`,
    );
    process.exitCode = 2;

    return;
  }

  const redirects = redirectLines(REDIRECTS);

  await bakeCanonicals(target, mainBuild, redirects);
  await writeSnapshotRules(
    root,
    version.path,
    readFileSync(join(PACKAGE, 'public', '_headers'), 'utf8'),
  );

  // A live snapshot has no committed manifest for the docs build to check, so its targets are checked here, against the build they were resolved from.
  if (!tag) {
    const { pages, missing } = await snapshotCanonicals(target, version.path);

    const problems = [
      ...missing.map((file) => `${file}: no canonical link`),
      ...canonicalProblems(pages, mainBuild, redirects),
    ];

    if (problems.length > 0) throw new Error(problems.join('\n'));
  }

  const pages = await snapshotPages(target);
  const { files, bytes } = snapshotDigest(root);

  console.log(
    `${relative(workspaceRoot, root)}: ${tag ?? 'this checkout'}, ${pages.length} pages, ${files} files, ${(bytes / 1e6).toFixed(1)} MB`,
  );
};

if (import.meta.main) await main();
