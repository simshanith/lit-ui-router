import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import type { Chunk } from '@tools/bundle-probe';
import { bundleEntry as probe, bundlers } from '@tools/bundle-probe';

const bundleEntry = (
  entry: string,
  bundler: (typeof bundlers)[number],
): ReturnType<typeof probe> =>
  probe(fileURLToPath(new URL(`../src/${entry}`, import.meta.url)), bundler);

// The package's thesis, mechanically enforced under both bundlers' differing
// tree-shake semantics: importing the root with only matcher-tier mounts must
// never load @uirouter/core. The simulate tier enters the root's module graph
// only through a dynamic import, so core lives in chunks the entry reaches
// through no static edge — a matcher-only consumer never fetches them.

// Chunks reachable from `start` over static import edges only.
const staticClosure = (chunks: Chunk[], start: Chunk): Set<Chunk> => {
  const byName = new Map(chunks.map((chunk) => [chunk.name, chunk]));
  const seen = new Set([start]);
  for (const chunk of seen) {
    for (const name of chunk.staticImports) {
      const imported = byName.get(name);
      if (imported) seen.add(imported);
    }
  }
  return seen;
};

for (const bundler of bundlers) {
  describe(`tree-shaking probe (${bundler})`, () => {
    it('bundles the root entry chunk with zero uirouter identifiers', async () => {
      const { entry } = await bundleEntry('index.ts', bundler);
      assert.doesNotMatch(entry.code, /uirouter/i);
    });

    it('confines core to chunks the entry reaches only through import()', async () => {
      const { entry, chunks } = await bundleEntry('index.ts', bundler);
      const coreChunks = chunks.filter((chunk) => /uirouter/i.test(chunk.code));
      assert.ok(coreChunks.length > 0, 'expected a chunk carrying core');
      const eager = staticClosure(chunks, entry);
      for (const chunk of coreChunks) {
        assert.ok(!eager.has(chunk), `entry statically reaches ${chunk.name}`);
      }
      // The lazy boundary exists: every core chunk sits behind a dynamic
      // import edge leaving the eager region.
      const byName = new Map(chunks.map((chunk) => [chunk.name, chunk]));
      const lazy = new Set(
        [...eager]
          .flatMap((chunk) => chunk.dynamicImports)
          .flatMap((name) => [...staticClosure(chunks, byName.get(name)!)]),
      );
      for (const chunk of coreChunks) {
        assert.ok(lazy.has(chunk), `entry never lazily reaches ${chunk.name}`);
      }
    });

    it('bundles the matcher and redirects tiers core-free', async () => {
      for (const entry of ['url-matcher.ts', 'redirects.ts']) {
        const { chunks } = await bundleEntry(entry, bundler);
        for (const chunk of chunks) {
          assert.doesNotMatch(
            chunk.code,
            /uirouter/i,
            `${entry}: ${chunk.name}`,
          );
        }
      }
    });

    it('keeps the adapter subpaths core-free at the entry (core stays lazy)', async () => {
      // Every adapter (Connect, Vite, fetch, Hono) fronts the root verdict API,
      // so they inherit its boundary: a matcher-only mount table drives them
      // without ever loading core, which lives behind the same dynamic simulate
      // import. Hono's type-only import is erased before bundling, so its entry
      // carries neither core nor hono.
      for (const entry of ['connect.ts', 'vite.ts', 'fetch.ts', 'hono.ts']) {
        const { entry: chunk } = await bundleEntry(entry, bundler);
        assert.doesNotMatch(
          chunk.code,
          /uirouter/i,
          `${entry} entry loads core`,
        );
      }
    });
  });
}
