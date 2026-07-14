// Shared IO for the published-versions manifest: the one path both the
// resolver (writer) and the diff check (reader) agree on. It is resolved
// registry state, not source, so it lives in the ecosystem-conventional
// node_modules/.cache — already ignored, out of the package's source
// listing, no gitignore entry needed. Turbo still hashes it: explicitly
// listed inputs under node_modules are hashed (probed on turbo 2.10.4).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  parseManifest,
  renderManifest,
  type PublishedVersions,
} from './published-versions.core.ts';
import { workspaceRoot } from '@tools/shared/workspace.ts';

/** Where resolve-published.ts writes and check-published-diff.ts reads. */
export const publishedVersionsPath = join(
  workspaceRoot,
  'node_modules',
  '.cache',
  'release',
  'published-versions.json',
);

/** Write the canonical manifest, creating the cache directory as needed. */
export async function writePublishedVersions(
  versions: PublishedVersions,
): Promise<void> {
  await mkdir(dirname(publishedVersionsPath), { recursive: true });
  await writeFile(publishedVersionsPath, renderManifest(versions));
}

/** Read the manifest; a missing file points at the resolve step. */
export async function readPublishedVersions(): Promise<PublishedVersions> {
  let text: string;
  try {
    text = await readFile(publishedVersionsPath, 'utf8');
  } catch {
    throw new Error(
      'node_modules/.cache/release/published-versions.json missing — run the resolve:published task first (the root check:published-diff script chains it).',
    );
  }
  return parseManifest(text);
}
