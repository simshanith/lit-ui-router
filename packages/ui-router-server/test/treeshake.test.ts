import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { build } from 'esbuild';

// The package's thesis, mechanically enforced: importing the root with only
// matcher-tier mounts must never load @uirouter/core. The simulate tier
// enters the root's module graph only through a dynamic import, so a
// splitting bundler emits it as a lazy chunk that a matcher-only consumer
// never fetches.
const bundle = (entry: string) =>
  build({
    entryPoints: [fileURLToPath(new URL(`../src/${entry}`, import.meta.url))],
    bundle: true,
    format: 'esm',
    splitting: true,
    outdir: 'probe-out',
    write: false,
    logLevel: 'silent',
  });

describe('tree-shaking probe', () => {
  it('bundles the root entry chunk with zero uirouter identifiers', async () => {
    const result = await bundle('index.ts');
    const entry = result.outputFiles.find((file) =>
      file.path.endsWith('/index.js'),
    );
    assert.ok(entry, 'expected an index.js entry chunk');
    assert.doesNotMatch(entry.text, /uirouter/i);
  });

  it('confines core to chunks the entry only imports dynamically', async () => {
    const result = await bundle('index.ts');
    const entry = result.outputFiles.find((file) =>
      file.path.endsWith('/index.js'),
    );
    assert.ok(entry);
    const coreChunks = result.outputFiles.filter(
      (file) => file !== entry && /uirouter/i.test(file.text),
    );
    assert.ok(coreChunks.length > 0, 'expected a chunk carrying core');
    for (const chunk of coreChunks) {
      const name = chunk.path.split('/').pop()!;
      // A static edge would appear as `from "./chunk.js"` or `import "./..."`;
      // the lazy boundary shows up only as `import("./chunk.js")`.
      assert.ok(
        !entry.text.includes(`from "./${name}"`) &&
          !entry.text.includes(`import "./${name}"`),
        `entry statically imports ${name}`,
      );
      assert.ok(
        entry.text.includes(`import("./${name}")`),
        `entry never lazily imports ${name}`,
      );
    }
  });

  it('bundles the matcher and redirects tiers core-free', async () => {
    for (const entry of ['url-matcher.ts', 'redirects.ts']) {
      const result = await bundle(entry);
      for (const file of result.outputFiles) {
        assert.doesNotMatch(file.text, /uirouter/i, `${entry}: ${file.path}`);
      }
    }
  });
});
