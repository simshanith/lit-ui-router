// Shared IO for the published-versions manifest: the one path both the
// resolver (writer) and the diff check (reader) agree on. Gitignored — it is
// resolved registry state, not source.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  parseManifest,
  type PublishedVersions,
} from './published-versions.core.ts';
import { workspaceRoot } from './workspace.ts';

/** Where resolve-published.ts writes and check-published-diff.ts reads. */
export const publishedVersionsPath = join(
  workspaceRoot,
  'tools',
  'release',
  'published-versions.json',
);

/** Read the manifest; a missing file points at the resolve step. */
export async function readPublishedVersions(): Promise<PublishedVersions> {
  let text: string;
  try {
    text = await readFile(publishedVersionsPath, 'utf8');
  } catch {
    throw new Error(
      'tools/release/published-versions.json missing — run the resolve:published task first (the root check:published-diff script chains it).',
    );
  }
  return parseManifest(text);
}
