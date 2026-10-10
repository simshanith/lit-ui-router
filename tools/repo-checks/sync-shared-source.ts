// Rewrites every packages/*/src/shared/ copy from the canonical source its
// header names. A new consumer starts as a file holding only that header line.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { expectedCopy } from './shared-source.core.ts';
import { onDisk, read } from './shared-source.ts';

const SYNC = 'sync-shared-source';

function main(): void {
  const { copies, canonicals } = onDisk();
  let written = 0;

  for (const [copy, canonical] of copies) {
    if (canonical === undefined || !canonicals.has(canonical)) {
      console.error(`${SYNC}: ${copy} names no canonical source; skipped`);
      process.exitCode = 1;
      continue;
    }

    const expected = expectedCopy(canonical, read(canonical));

    if (read(copy) === expected) continue;
    writeFileSync(join(workspaceRoot, copy), expected);
    written += 1;
    console.log(`${SYNC}: wrote ${copy}`);
  }

  console.log(`${SYNC}: ${written} of ${copies.size} copies rewritten`);
}

if (import.meta.main) main();
