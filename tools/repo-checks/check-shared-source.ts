// The canonical sources under packages/shared/*/src/ must hold no module
// state: each consumer inlines its own copy into dist/, which would split it.
// Each must also be exported, since oxc-emit inlines exported files only.
import { globSync, readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';

import { requireManifest } from '@tools/bootstrap/manifest.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import {
  CANONICAL_EXCLUDE,
  CANONICAL_GLOB,
  statefulStatements,
  unexportedSources,
} from './shared-source.core.ts';

const CHECK = 'check-shared-source';

function main(): void {
  const canonicals = globSync(CANONICAL_GLOB, {
    cwd: workspaceRoot,
    exclude: CANONICAL_EXCLUDE,
  }).sort();

  if (canonicals.length === 0) {
    console.error(`${CHECK}: no canonical sources found`);
    process.exitCode = 1;

    return;
  }

  const stateful = canonicals.flatMap((file) =>
    statefulStatements(file, readFileSync(join(workspaceRoot, file), 'utf8')),
  );

  for (const line of stateful) {
    console.error(`${CHECK}: module state or side effect at ${line}`);
  }

  const packages = [
    ...new Set(canonicals.map((file) => posix.dirname(dirname(file)))),
  ];

  const unexported = unexportedSources(
    canonicals,
    new Map(
      packages.map((dir) => [
        dir,
        requireManifest(join(workspaceRoot, dir)).exports,
      ]),
    ),
  );

  for (const file of unexported) {
    console.error(
      `${CHECK}: ${file} is not in its package's exports, so oxc-emit never inlines it`,
    );
  }

  if (stateful.length > 0 || unexported.length > 0) {
    process.exitCode = 1;

    return;
  }

  console.log(
    `${CHECK}: ${canonicals.length} canonical sources hold no state and are exported`,
  );
}

if (import.meta.main) main();
