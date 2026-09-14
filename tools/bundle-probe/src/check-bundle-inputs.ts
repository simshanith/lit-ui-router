#!/usr/bin/env node
// Two bundle invariants for a package's exported entries, off one bundle per
// entry per bundler (both bundlers, declared dependencies and peers external):
//
// 1. Declared-deps-only — fail when any module resolves from outside the
//    package, the undeclared import the workspace install would otherwise mask.
// 2. Boundary claims — fail when an entry statically reaches a package its
//    `bundleProbe.<subpath>.free` claim says it bundles without. Only the
//    static graph counts: a lazily-imported chunk is the boundary such a claim
//    is built on (see free-of.ts).
//
// Entries and claims derive from package.json (see entries.ts); no arguments.
// Usage (from the package dir): check-bundle-inputs
import path from 'node:path';

import { bundleEntry, bundlers, DEVELOPMENT_DEFINE } from './bundle.ts';
import { readPackageProbe } from './entries.ts';
import { violations } from './free-of.ts';

const packageDir = process.cwd();
const { name, declared, entries } = readPackageProbe(packageDir);

let failed = false;
for (const { label, file, free } of entries) {
  for (const bundler of bundlers) {
    // annotations:false keeps side-effect modules in the graph, so an
    // undeclared import can't hide behind a dist-named sideEffects glob.
    // DEVELOPMENT_DEFINE, not production: the dev branches are the larger
    // module graph, so an undeclared import cannot hide behind a folded guard.
    const result = await bundleEntry(file, bundler, {
      external: declared,
      annotations: false,
      define: DEVELOPMENT_DEFINE,
    });
    const { inputs } = result;
    const reached = free.length > 0 ? violations(result, free) : [];
    if (reached.length > 0) {
      failed = true;
      console.error(
        `[bundle-probe] ${name} ${label} (${bundler}): static imports from [${free.join(', ')}], which this entry claims to bundle without`,
      );
      for (const specifier of reached) console.error(`  ${specifier}`);
    }
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
const claimed = entries.filter((entry) => entry.free.length > 0);
for (const entry of claimed) {
  console.log(
    `[bundle-probe] ${name}: ${entry.label} statically bundles without [${entry.free.join(', ')}].`,
  );
}
