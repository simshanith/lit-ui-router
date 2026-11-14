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
import { cp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, relative } from 'node:path';

import { workspaceRoot } from '@tools/bootstrap/root.ts';

import { REDIRECTS } from '../catalog/redirects.ts';
import { redirectLines } from '../.vitepress/redirects.ts';
import {
  bakeCanonicals,
  finishSnapshot,
  hasSnapshotTag,
  snapshotDigest,
  snapshotPackage,
  snapshotPages,
  SNAPSHOT_TAGS,
  writeSnapshotRules,
} from '../.vitepress/snapshot.ts';
import { BUNDLED_MANIFEST } from '../.vitepress/versions.ts';

// Builds a frozen docs snapshot: the whole site at a release tag, under its version's base, into
// the assets directory of that version's Worker package (www/<id>.versions.lit-ui-router.dev/dist/).
// Usage: docs-snapshot.ts [version-id] [--bake-only], default v1. --bake-only skips the tag build
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

/** Builds the tag's site under the version's base into `target`, finished but without canonical links. */
async function buildAtTag(
  tag: string,
  path: string,
  label: string,
  target: string,
): Promise<void> {
  const checkout = mkdtempSync(join(tmpdir(), 'docs-snapshot-'));
  const out = join(checkout, 'snapshot-out');
  const site = join(checkout, SITE);

  try {
    run(workspaceRoot, 'git', [
      'worktree',
      'add',
      '--detach',
      checkout,
      `${tag}^{commit}`,
    ]);
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
    await finishSnapshot(out, path, label, sampleAppAssets(site));

    if (!(await snapshotPages(out)).includes('index.html'))
      throw new Error(`${out}: no index.html`);

    await rm(target, { recursive: true, force: true });
    await mkdir(join(target, '..'), { recursive: true });
    await cp(out, target, { recursive: true });
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

  if (!tag || !version) {
    console.error(
      `docs-snapshot.ts: no snapshot tag or versions.json entry for ${id}`,
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

  if (!bakeOnly) await buildAtTag(tag, version.path, version.label, target);

  if (!existsSync(join(target, 'index.html'))) {
    console.error(
      `docs-snapshot.ts: ${relative(workspaceRoot, target)} holds no snapshot to bake: run without --bake-only`,
    );
    process.exitCode = 2;

    return;
  }

  await bakeCanonicals(target, mainBuild, redirectLines(REDIRECTS));
  await writeSnapshotRules(
    root,
    version.path,
    readFileSync(join(PACKAGE, 'public', '_headers'), 'utf8'),
  );

  const pages = await snapshotPages(target);
  const { files, bytes } = snapshotDigest(root);

  console.log(
    `${relative(workspaceRoot, root)}: ${tag}, ${pages.length} pages, ${files} files, ${(bytes / 1e6).toFixed(1)} MB`,
  );
};

if (import.meta.main) await main();
