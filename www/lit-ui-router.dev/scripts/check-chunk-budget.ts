#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as v from 'valibot';

/** Where the docs build's chunk-budget plugin writes the client chunk sizes. */
export const CHUNK_SIZES_PATH = '.cache/chunk-sizes.json';

// vite's own build.chunkSizeWarningLimit default, applied to every client chunk.
export const CHUNK_BUDGET_KB = 500;

// The lazy local-search index (API pages included) measures ~728 kB; the budget leaves 20% headroom.
export const SEARCH_INDEX_BUDGET_KB = 875;

const POLICY = 'https://github.com/simshanith/lit-ui-router/issues/1340';

const ChunkSizes = v.array(
  v.strictObject({
    fileName: v.string(),
    name: v.string(),
    bytes: v.number(),
    gzipBytes: v.optional(v.number()),
  }),
);

export type ChunkSize = v.InferOutput<typeof ChunkSizes>[number];

export const isSearchIndex = (chunk: Pick<ChunkSize, 'name'>): boolean =>
  chunk.name.startsWith('@localSearchIndex');

/** Each chunk over its budget, as a message naming the chunk, its size and the budget. */
export function overBudget(chunks: readonly ChunkSize[]): string[] {
  return chunks.flatMap((chunk) => {
    const budget = isSearchIndex(chunk)
      ? SEARCH_INDEX_BUDGET_KB
      : CHUNK_BUDGET_KB;

    const kB = chunk.bytes / 1000;

    return kB > budget
      ? [
          `${chunk.fileName} is ${kB.toFixed(1)} kB, over its ${budget} kB budget`,
        ]
      : [];
  });
}

const main = (): void => {
  const path = join(import.meta.dirname, '..', CHUNK_SIZES_PATH);
  const chunks = v.parse(ChunkSizes, JSON.parse(readFileSync(path, 'utf8')));

  if (chunks.length === 0) {
    console.error(`check-chunk-budget: ${CHUNK_SIZES_PATH} lists no chunks`);
    process.exitCode = 1;

    return;
  }

  for (const chunk of chunks.filter(isSearchIndex)) {
    console.log(
      `chunk-budget: ${chunk.fileName} ${(chunk.bytes / 1000).toFixed(1)} kB of ${SEARCH_INDEX_BUDGET_KB} kB`,
    );
  }

  const over = overBudget(chunks);

  if (over.length === 0) return;

  for (const message of over) console.error(`check-chunk-budget: ${message}`);
  console.error(
    `Raise the budget in www/lit-ui-router.dev/scripts/check-chunk-budget.ts to 20% over the measured size, with the sizes in the commit (policy: ${POLICY}).`,
  );
  process.exitCode = 1;
};

if (import.meta.main) main();
