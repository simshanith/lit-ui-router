#!/usr/bin/env node
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { readManifest } from '@tools/bootstrap/manifest.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';

import { releaseStubs, STUB_DIR } from '../.vitepress/release-stubs.ts';

// Writes one Markdown stub per published package under packages/, for local search to index.

const SITE = join(import.meta.dirname, '..');

const main = (): void => {
  const packages = join(workspaceRoot, 'packages');

  const manifests = readdirSync(packages).flatMap(
    (dir) => readManifest(join(packages, dir)) ?? [],
  );

  // A stub whose package is gone must not outlive it.
  rmSync(join(SITE, STUB_DIR), { recursive: true, force: true });
  mkdirSync(join(SITE, STUB_DIR));

  for (const { file, markdown } of releaseStubs(manifests)) {
    writeFileSync(join(SITE, file), markdown);
  }
};

if (import.meta.main) main();
