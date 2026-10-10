// The files on disk the shared-source check and sync work over.
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import {
  CANONICAL_EXCLUDE,
  CANONICAL_GLOB,
  canonicalOf,
  COPY_GLOB,
  type CopyAudit,
} from './shared-source.core.ts';

export const read = (path: string): string =>
  readFileSync(join(workspaceRoot, path), 'utf8');

export function onDisk(): CopyAudit {
  const glob = (pattern: string, exclude: string[] = []) =>
    globSync(pattern, { cwd: workspaceRoot, exclude }).sort();

  return {
    canonicals: new Set(glob(CANONICAL_GLOB, CANONICAL_EXCLUDE)),
    copies: new Map(
      glob(COPY_GLOB).map((copy) => [copy, canonicalOf(read(copy))]),
    ),
    read,
  };
}
