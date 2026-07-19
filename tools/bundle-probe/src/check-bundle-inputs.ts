#!/usr/bin/env node
// Declared-deps-only invariant for a package's exported entries: bundle each
// entry (both bundlers) with the package's declared dependencies and peers
// external, then fail when any module resolves from outside the package —
// the undeclared import the workspace install would otherwise mask. Entries
// derive from the exports map (see entries.ts); no arguments.
// Usage (from the package dir): check-bundle-inputs
import path from 'node:path';

import { bundleEntry, bundlers } from './bundle.ts';
import { readPackageProbe } from './entries.ts';

const packageDir = process.cwd();
const { name, declared, entries } = await readPackageProbe(packageDir);

let failed = false;
for (const { label, file } of entries) {
  for (const bundler of bundlers) {
    // annotations:false keeps side-effect modules in the graph, so an
    // undeclared import can't hide behind a dist-named sideEffects glob.
    const { inputs } = await bundleEntry(file, bundler, {
      external: declared,
      annotations: false,
    });
    const outside = inputs.filter(
      (input) =>
        !input.startsWith('\0') &&
        !path.resolve(packageDir, input).startsWith(packageDir + path.sep),
    );
    if (outside.length === 0) continue;
    failed = true;
    console.error(
      `[bundle-probe] ${name} ${label} (${bundler}): inputs outside the package — undeclared dependency?`,
    );
    for (const input of outside) console.error(`  ${input}`);
  }
}

if (failed) process.exit(1);
console.log(
  `[bundle-probe] ${name}: exported entries [${entries
    .map((entry) => entry.label)
    .join(', ')}] bundle from declared deps only (${bundlers.join(', ')}).`,
);
