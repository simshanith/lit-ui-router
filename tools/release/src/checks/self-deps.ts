// IO shell for the self-dependency guard; decisions live in the pure,
// unit-tested ./self-deps.core.ts.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatUndeclared, undeclaredMembers } from './self-deps.core.ts';
import { requireManifest } from '@tools/shared/manifest.ts';

// This file lives in <package>/src/checks.
const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Throw when a publishable workspace member lacks a dependency edge here. */
export function assertSelfDeclaredDeps(publishable: string[]): void {
  const missing = undeclaredMembers(publishable, requireManifest(packageDir));
  if (missing.length > 0) throw new Error(formatUndeclared(missing));
}
