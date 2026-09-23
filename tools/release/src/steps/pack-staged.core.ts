// Pure logic for the pack-staged.ts staging copy.

import { basename } from 'node:path';

// node_modules is irrelevant to pack; the rest is transient output sibling turbo lanes write and delete mid-copy.
export const STAGING_SKIP: ReadonlySet<string> = new Set([
  '.cache',
  '.turbo',
  '.vitest',
  'coverage',
  'node_modules',
]);

// Stale *.tgz would confuse pickTarball.
export function keepEntry(source: string): boolean {
  const name = basename(source);
  return !STAGING_SKIP.has(name) && !name.endsWith('.tgz');
}
