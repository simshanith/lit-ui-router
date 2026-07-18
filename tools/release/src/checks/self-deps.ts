// IO shell for the self-dependency guard; decisions live in the pure,
// unit-tested ./self-deps.core.ts.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatUndeclared, undeclaredMembers } from './self-deps.core.ts';
import type { PackageManifest } from '@tools/shared/types.ts';

// This file lives in <package>/src/checks.
const manifestPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'package.json',
);

/** Throw when a publishable workspace member lacks a dependency edge here. */
export async function assertSelfDeclaredDeps(
  publishable: string[],
): Promise<void> {
  const manifest = JSON.parse(
    await readFile(manifestPath, 'utf8'),
  ) as PackageManifest;
  const missing = undeclaredMembers(publishable, manifest);
  if (missing.length > 0) throw new Error(formatUndeclared(missing));
}
