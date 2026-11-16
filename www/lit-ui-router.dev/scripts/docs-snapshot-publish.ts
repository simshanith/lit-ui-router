#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

import { workspaceRoot } from '@tools/bootstrap/root.ts';

import {
  canonicalOf,
  hasSnapshotTag,
  htmlPath,
  manifestPath,
  snapshotDigest,
  snapshotPackage,
  snapshotPages,
  SNAPSHOT_TAGS,
  type SnapshotManifest,
} from '../.vitepress/snapshot.ts';

// Deploys a baked snapshot (docs-snapshot.ts) to its version's Worker with cf, then writes the
// manifest the repo keeps in its place: catalog/snapshots/<id>.json.
// Usage: docs-snapshot-publish.ts [version-id] [--dry-run], default v1. --dry-run builds and
// checks the deploy without uploading, and prints the manifest instead of writing it.

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const id = args.find((arg) => !arg.startsWith('--')) ?? 'v1';

  if (!hasSnapshotTag(id)) {
    console.error(`docs-snapshot-publish.ts: no snapshot tag for ${id}`);
    process.exitCode = 2;

    return;
  }

  const pkg = join(workspaceRoot, snapshotPackage(id));
  const root = join(pkg, 'dist');
  const dir = join(root, id);

  if (
    !existsSync(join(dir, 'index.html')) ||
    !existsSync(join(root, '_redirects'))
  ) {
    console.error(
      `docs-snapshot-publish.ts: ${relative(workspaceRoot, root)} holds no baked snapshot: run docs-snapshot.ts ${id}`,
    );
    process.exitCode = 2;

    return;
  }

  const pages: Record<string, string> = {};
  const missing: string[] = [];

  for (const file of await snapshotPages(dir)) {
    if (file === '404.html') continue;
    const canonical = canonicalOf(readFileSync(join(dir, file), 'utf8'));

    if (canonical === undefined) missing.push(file);
    else pages[`/${id}${htmlPath(file)}`] = canonical;
  }

  if (missing.length > 0) {
    console.error(
      `docs-snapshot-publish.ts: pages without a canonical link, run docs-snapshot.ts ${id} --bake-only:\n  ${missing.join('\n  ')}`,
    );
    process.exitCode = 1;

    return;
  }

  const manifest: SnapshotManifest = {
    tag: SNAPSHOT_TAGS[id],
    ...snapshotDigest(root),
    pages,
  };

  execFileSync(
    'pnpm',
    [
      'run',
      'deploy',
      ...(dryRun ? ['--dry-run'] : []),
      '--message',
      `${manifest.tag} docs snapshot ${manifest.sha256.slice(0, 12)}`,
    ],
    { cwd: pkg, stdio: 'inherit' },
  );

  const target = manifestPath(id);
  const text = `${JSON.stringify(manifest, null, 2)}\n`;

  if (dryRun) {
    const { pages: listed, ...summary } = manifest;

    console.log(
      `dry run: would write ${relative(workspaceRoot, target)}: ${JSON.stringify(summary)}, ${Object.keys(listed).length} pages`,
    );

    return;
  }

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, text);
  console.log(
    `${relative(workspaceRoot, target)}: ${manifest.files} files, ${manifest.sha256}`,
  );
};

if (import.meta.main) await main();
