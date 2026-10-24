// The worker in workerd through wrangler's test harness, under the config cloudflare.config.ts
// gives production, its npm registry reads answered by worker/test/registry-stub.ts.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';

import {
  convertToWranglerConfig,
  loadAndParseConfig,
} from '@cloudflare/config';
import { createTestHarness, type Unstable_RawConfig } from 'wrangler';

import type { DiffIndex } from './diff-index.ts';
import type { FileFilter } from './file-filter.ts';
import { formatDiff } from './format-diff.ts';
import { files } from './npm-diff-fixtures.ts';
import {
  type DiffBucket,
  type DiffPair,
  filesKey,
  indexKey,
  patchKey,
  writeEntry,
} from './store.ts';

const ROOT = join(import.meta.dirname, '..');

// wrangler writes its bundles under <root>/.wrangler; keep them out of the tree turbo hashes.
const SCRATCH = mkdtempSync(join(tmpdir(), 'release-diffs-'));

const loaded = await loadAndParseConfig(join(ROOT, 'cloudflare.config.ts'), {
  isPreview: false,
  mode: undefined,
});

if (!loaded.result.success) throw loaded.result.error;

// SAFETY: @cloudflare/config types this as @cloudflare/workers-utils' RawConfig, which it doesn't ship, so it reads as any.
const production = convertToWranglerConfig(
  loaded.result.data,
) as Unstable_RawConfig;

const server = createTestHarness({
  root: SCRATCH,
  workers: [
    {
      config: {
        ...production,
        main: join(ROOT, 'worker/test/registry-stub.ts'),
      },
    },
  ],
});

/** The default entrypoint's RPC methods, as the docs worker's service binding sees them, and the stub's. */
interface ReleaseDiffs {
  index(pair: DiffPair): Promise<DiffIndex>;
  files(
    pair: DiffPair,
    filter: FileFilter,
  ): Promise<ReadableStream<Uint8Array>>;
  patch(pair: DiffPair): Promise<ReadableStream<Uint8Array>>;
  registryReads(): Promise<string[]>;
}

let api: ReleaseDiffs;

let bucket: DiffBucket & { list(): Promise<{ objects: { key: string }[] }> };

before(async () => {
  await server.listen();

  const worker = server.getWorker<{ DIFFS: typeof bucket }>();

  // SAFETY: the stub's default export is the entrypoint above.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- getExport types it as a fetch handler, and the node graph has no Rpc types to name it by
  api = (await worker.getExport()) as unknown as ReleaseDiffs;
  ({ DIFFS: bucket } = await worker.getEnv());
});

after(async () => {
  await server.close();
  rmSync(SCRATCH, { recursive: true, force: true });
});

beforeEach(async () => {
  await api.registryReads();
});

// worker/test/registry-stub.ts's fixture package.
const STUB: DiffPair = { name: 'stub-pkg', from: '1.0.0', to: '1.1.0' };

const text = (stream: ReadableStream<Uint8Array>) =>
  new Response(stream).text();

describe('a pair R2 holds', { timeout: 120_000 }, () => {
  const pair: DiffPair = { name: '@scope/seeded', from: '2.0.0', to: '2.1.0' };

  const patch = new TextEncoder().encode(
    `${formatDiff({
      a: files(['src/a.ts', 'a\n'], ['dist/a.d.ts', 'a\n']),
      b: files(['src/a.ts', 'b\n'], ['dist/a.d.ts', 'b\n']),
      versions: { a: pair.from, b: pair.to },
    })}\n`,
  );

  before(() => writeEntry(bucket, pair, patch));

  it('answers from R2 without reaching the registry', async () => {
    const index = await api.index(pair);

    assert.deepEqual(
      index.files.map(({ path, filters }) => [path, filters]),
      [
        ['src/a.ts', ['src', 'all']],
        ['dist/a.d.ts', ['types', 'all']],
      ],
    );
    assert.match(
      await text(await api.files(pair, 'types')),
      /^diff --git a\/dist\/a\.d\.ts /,
    );
    assert.equal(
      await text(await api.patch(pair)),
      new TextDecoder().decode(patch),
    );
    assert.deepEqual(await api.registryReads(), []);
  });
});

describe('a pair R2 lacks', { timeout: 120_000 }, () => {
  // The harness proxy's calls block node, so they can't race here; store.test.ts covers the single flight.
  it('builds it in its ReleaseDiff object, stores every key, then serves R2', async () => {
    const index = await api.index(STUB);

    // One packument read and one read per tarball.
    assert.equal((await api.registryReads()).length, 3);
    assert.deepEqual(
      index.files.map(({ path, kind }) => [path, kind]),
      [
        ['package.json', 'modified'],
        ['src/index.ts', 'modified'],
        ['dist/index.js', 'modified'],
        ['dist/index.d.ts', 'modified'],
      ],
    );

    const keys = (await bucket.list()).objects.map(({ key }) => key);

    for (const key of [
      patchKey(STUB),
      filesKey(STUB, 'src'),
      filesKey(STUB, 'js'),
      filesKey(STUB, 'types'),
      filesKey(STUB, 'all'),
      indexKey(STUB),
    ])
      assert.ok(keys.includes(key), key);

    assert.equal(
      await text(await api.files(STUB, 'all')),
      await text(await api.patch(STUB)),
    );
    assert.match(
      await text(await api.files(STUB, 'js')),
      /^diff --git a\/dist\/index\.js b\/dist\/index\.js\n/,
    );
    assert.deepEqual(await api.registryReads(), []);
  });
});

describe('the RPC surface', { timeout: 120_000 }, () => {
  it('refuses a pair that could not name an R2 prefix', async () => {
    await assert.rejects(
      async () => api.index({ name: '../escape', from: '1.0.0', to: '1.1.0' }),
      /ValiError/,
    );
    await assert.rejects(
      async () => api.index({ ...STUB, from: '1.0.0/..' }),
      /ValiError/,
    );
  });

  it('refuses an unknown preset', async () => {
    await assert.rejects(
      // SAFETY: an RPC caller's argument is untyped at runtime.
      async () => api.files(STUB, 'everything' as FileFilter),
      /ValiError/,
    );
  });

  it('fails a version the registry lacks, storing nothing', async () => {
    const pair = { ...STUB, to: '9.9.9' };

    await assert.rejects(
      async () => api.index(pair),
      /NotPublished: stub-pkg@9\.9\.9/,
    );
    assert.equal(
      (await bucket.list()).objects.some(({ key }) =>
        key.includes('...9.9.9/'),
      ),
      false,
    );
  });
});
