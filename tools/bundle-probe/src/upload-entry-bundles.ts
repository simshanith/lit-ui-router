#!/usr/bin/env node
// Codecov bundle series per exported entry: rolldown (the vite-8-era
// consumer bundler) emits each entry minified with declared dependencies and
// peers external into dist/.stats/ (dot-dir: machinery, not artifact — the
// packages' files negation keeps it out of the tarball), then the shared uploader ships one
// <prefix>-<label>-esm series per entry. Entries and labels derive from the
// exports map (see entries.ts); the optional prefix argument overrides the
// package name (series continuity). CODECOV_TOKEN unset stays the uploader's
// clean skip.
// Usage (from the package dir): upload-entry-bundles [prefix]
import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { bundleEntry } from './bundle.ts';
import { readPackageProbe } from './entries.ts';

const packageDir = process.cwd();
const { name, declared, entries } = await readPackageProbe(packageDir);
const prefix = process.argv[2] ?? name;

const uploader = fileURLToPath(
  import.meta.resolve('@tools/build_and_test/src/upload-bundle-stats.ts'),
);

const statsRoot = path.join(packageDir, 'dist', '.stats');
await rm(statsRoot, { recursive: true, force: true });

console.log(
  `[bundle-probe] ${name}: uploading exported entries [${entries
    .map((entry) => entry.label)
    .join(', ')}] as ${prefix}-<label>-esm.`,
);

for (const { label, file } of entries) {
  // annotations:false mirrors consumer reality for registration entries:
  // sideEffects globs name dist/*.js, so probing src/*.ts would otherwise
  // shake side-effect modules to zero bytes.
  const { chunks } = await bundleEntry(file, 'rolldown', {
    minify: true,
    external: declared,
    annotations: false,
  });
  const dir = path.join(statsRoot, label);
  await mkdir(dir, { recursive: true });
  for (const chunk of chunks) {
    await writeFile(path.join(dir, chunk.name), chunk.code);
  }
  execFileSync(
    process.execPath,
    [uploader, `${prefix}-${label}-esm`, dir, '--no-manifest'],
    { stdio: 'inherit' },
  );
}
