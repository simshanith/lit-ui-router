#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  globSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, relative } from 'node:path';

import { workspaceRoot } from '@tools/bootstrap/root.ts';

import {
  finishSnapshot,
  hasSnapshotTag,
  snapshotPages,
  SNAPSHOT_TAGS,
  SNAPSHOTS_DIR,
} from '../.vitepress/snapshot.ts';
import { BUNDLED_MANIFEST } from '../.vitepress/versions.ts';

// Builds a frozen docs snapshot: the whole site at a release tag, under its version's base.
// Usage: docs-snapshot.ts [version-id], default v1. Writes snapshots/<id>/ in this package.

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

const main = async (): Promise<void> => {
  const id = process.argv[2] ?? 'v1';
  const tag = hasSnapshotTag(id) ? SNAPSHOT_TAGS[id] : undefined;
  const version = BUNDLED_MANIFEST.others.find((other) => other.id === id);

  if (!tag || !version) {
    console.error(
      `docs-snapshot.ts: no snapshot tag or versions.json entry for ${id}`,
    );
    process.exitCode = 2;

    return;
  }

  const checkout = mkdtempSync(join(tmpdir(), `docs-snapshot-${id}-`));
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
      version.path,
      '--outDir',
      out,
    ]);
    await finishSnapshot(
      out,
      version.path,
      version.label,
      sampleAppAssets(site),
    );

    const pages = await snapshotPages(out);

    if (!pages.includes('index.html')) throw new Error(`${out}: no index.html`);

    const target = join(SNAPSHOTS_DIR, id);

    await rm(target, { recursive: true, force: true });
    await cp(out, target, { recursive: true });

    const files = globSync('**/*', { cwd: target }).filter((file) =>
      statSync(join(target, file)).isFile(),
    );

    const bytes = files.reduce(
      (sum, file) => sum + statSync(join(target, file)).size,
      0,
    );

    console.log(
      `${relative(workspaceRoot, target)}: ${tag}, ${pages.length} pages, ${files.length} files, ${(bytes / 1e6).toFixed(1)} MB`,
    );
  } finally {
    run(workspaceRoot, 'git', ['worktree', 'remove', '--force', checkout]);
  }
};

if (import.meta.main) await main();
