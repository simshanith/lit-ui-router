#!/usr/bin/env node
// Codecov bundle series per public entry: rolldown (the vite-8-era consumer
// bundler) emits each entry minified with declared dependencies and peers
// external into dist-stats/, then the shared uploader ships one
// <prefix>-<label>-esm series per entry. CODECOV_TOKEN unset stays the
// uploader's clean skip.
// Usage (from the package dir): upload-entry-bundles <prefix> [label=]<entry.ts> ...
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { bundleEntry } from './bundle.ts';

const [prefix, ...specs] = process.argv.slice(2);

if (!prefix || specs.length === 0) {
  console.error('usage: upload-entry-bundles <prefix> [label=]<entry.ts> ...');
  process.exit(1);
}

const packageDir = process.cwd();
const manifest = JSON.parse(
  await readFile(path.join(packageDir, 'package.json'), 'utf8'),
) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
const declared = [
  ...Object.keys(manifest.dependencies ?? {}),
  ...Object.keys(manifest.peerDependencies ?? {}),
];

const uploader = fileURLToPath(
  import.meta.resolve('@tools/build_and_test/src/upload-bundle-stats.ts'),
);

const statsRoot = path.join(packageDir, 'dist-stats');
await rm(statsRoot, { recursive: true, force: true });

for (const spec of specs) {
  const eq = spec.indexOf('=');
  const file = eq === -1 ? spec : spec.slice(eq + 1);
  const label =
    eq === -1 ? path.basename(file, path.extname(file)) : spec.slice(0, eq);
  // annotations:false mirrors consumer reality for registration entries:
  // sideEffects globs name dist/*.js, so probing src/*.ts would otherwise
  // shake side-effect modules to zero bytes.
  const { chunks } = await bundleEntry(
    path.resolve(packageDir, file),
    'rolldown',
    {
      minify: true,
      external: declared,
      annotations: false,
    },
  );
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
