// Shared IO for the published-versions manifest: the one path both the
// resolver (writer) and the diff check (reader) agree on. It is resolved
// registry state, not source, so it lives in the gitignored package-local
// .cache; explicitly listed gitignored inputs are still hashed by turbo.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { publishedVersionsPath } from './cache-paths.ts';
import {
  parseManifest,
  renderManifest,
  type PublishedVersions,
} from './published-versions.core.ts';

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
      'tools/release/.cache/published-versions.json missing — run the resolve:published task first (the root check:published-diff script chains it).',
    );
  }
  return parseManifest(text);
}
