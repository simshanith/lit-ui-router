// IO shell for the pack-edge guard; decisions live in the pure,
// unit-tested ./self-deps.core.ts.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatUndeclared, undeclaredMembers } from './self-deps.core.ts';
import { readTurboTaskDeps } from '@tools/shared/turbo.ts';

// This file lives in <package>/src/checks.
const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Throw when a publishable workspace member lacks a pack:all edge here. */
export function assertSelfDeclaredDeps(publishable: string[]): void {
  const packAllDeps = readTurboTaskDeps(packageDir)['pack:all'] ?? [];
  const missing = undeclaredMembers(publishable, packAllDeps);
  if (missing.length > 0) throw new Error(formatUndeclared(missing));
}
