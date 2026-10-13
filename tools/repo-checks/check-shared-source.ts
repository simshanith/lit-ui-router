// The canonical sources under packages/shared/*/src/ must hold no module
// state: each consumer inlines its own copy into dist/, which would split it.
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import {
  CANONICAL_EXCLUDE,
  CANONICAL_GLOB,
  statefulStatements,
} from './shared-source.core.ts';

const CHECK = 'check-shared-source';

function main(): void {
  const canonicals = globSync(CANONICAL_GLOB, {
    cwd: workspaceRoot,
    exclude: CANONICAL_EXCLUDE,
  }).sort();

  if (canonicals.length === 0) {
    console.error(`${CHECK}: no canonical sources found`);
    process.exit(1);
  }

  const stateful = canonicals.flatMap((file) =>
    statefulStatements(file, readFileSync(join(workspaceRoot, file), 'utf8')),
  );

  for (const line of stateful) {
    console.error(`${CHECK}: module state or side effect at ${line}`);
  }

  if (stateful.length > 0) process.exit(1);

  console.log(`${CHECK}: ${canonicals.length} canonical sources hold no state`);
}

if (import.meta.main) main();
