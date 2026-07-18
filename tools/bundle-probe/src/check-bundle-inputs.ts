#!/usr/bin/env node
// Declared-deps-only invariant for a package's public entries: bundle each
// entry (both bundlers) with the package's declared dependencies and peers
// external, then fail when any module resolves from outside the package —
// the undeclared import the workspace install would otherwise mask.
// Usage (from the package dir): check-bundle-inputs <entry.ts> [...entries]
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { bundleEntry, bundlers } from './bundle.ts';

const entries = process.argv.slice(2);

if (entries.length === 0) {
  console.error('usage: check-bundle-inputs <entry.ts> [...entries]');
  process.exit(1);
}

const packageDir = process.cwd();
const manifest = JSON.parse(
  await readFile(path.join(packageDir, 'package.json'), 'utf8'),
) as {
  name: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
const declared = [
  ...Object.keys(manifest.dependencies ?? {}),
  ...Object.keys(manifest.peerDependencies ?? {}),
];

let failed = false;
for (const entry of entries) {
  for (const bundler of bundlers) {
    // annotations:false keeps side-effect modules in the graph, so an
    // undeclared import can't hide behind a dist-named sideEffects glob.
    const { inputs } = await bundleEntry(
      path.resolve(packageDir, entry),
      bundler,
      { external: declared, annotations: false },
    );
    const outside = inputs.filter(
      (input) =>
        !input.startsWith('\0') &&
        !path.resolve(packageDir, input).startsWith(packageDir + path.sep),
    );
    if (outside.length > 0) {
      failed = true;
      console.error(
        `[bundle-probe] ${manifest.name} ${entry} (${bundler}): inputs outside the package — undeclared dependency?`,
      );
      for (const input of outside) console.error(`  ${input}`);
    }
  }
}

if (failed) process.exit(1);
console.log(
  `[bundle-probe] ${manifest.name}: ${entries.length} entries bundle from declared deps only (${bundlers.join(', ')}).`,
);
