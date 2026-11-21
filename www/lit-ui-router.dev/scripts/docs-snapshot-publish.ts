#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { promisify } from 'node:util';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { parse } from 'jsonc-parser';
import * as v from 'valibot';

import {
  canonicalOf,
  htmlPath,
  lineFiles,
  listPrefixes,
  manifestPath,
  markerBody,
  markerKey,
  md5Of,
  ownsKey,
  readSnapshotManifest,
  snapshotDigest,
  snapshotPackage,
  snapshotPages,
  snapshotTag,
  type SnapshotManifest,
  uploadPlan,
} from '../.vitepress/snapshot.ts';
import { contentTypeOf, SNAPSHOT_LINES } from '../worker/snapshot.ts';

// Uploads a baked snapshot (docs-snapshot.ts) to the docs snapshot bucket with cf, then writes the
// manifest the repo keeps in its place: catalog/snapshots/<id>.json.
// Usage: docs-snapshot-publish.ts [version-id] [--dry-run], default v1. --dry-run lists the bucket
// and prints what it would upload and write, without uploading or writing.

const PACKAGE = join(import.meta.dirname, '..');

/** Uploads in flight at once; each is one `cf` process. */
const CONCURRENCY = 8;

/** The API allows 1200 requests per 300 seconds; starts are spaced to stay under it. */
const START_SPACING_MS = 260;

/** A 429 waits this long, doubling per retry. */
const BACKOFF_MS = 15_000;

const RETRIES = 5;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** cf's message for the API's rate limit. */
const RATE_LIMITED = /429|\[10500\]/;

const run = promisify(execFile);

const WranglerConfig = v.object({
  r2_buckets: v.array(
    v.object({ binding: v.string(), bucket_name: v.string() }),
  ),
});

/** The bucket the docs worker reads the snapshots from, as wrangler.jsonc binds it. */
function bucketName(): string {
  const config = v.parse(
    WranglerConfig,
    parse(readFileSync(join(PACKAGE, 'wrangler.jsonc'), 'utf8')),
  );

  const bucket = config.r2_buckets.find(
    ({ binding }) => binding === 'DOCS_SNAPSHOTS',
  );

  if (!bucket) throw new Error('wrangler.jsonc binds no DOCS_SNAPSHOTS bucket');

  return bucket.bucket_name;
}

let nextStart = 0;

/** Runs cf, spacing starts under the API's rate limit and backing off on a 429. */
async function cf(args: readonly string[]): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const now = Date.now();
    const start = Math.max(now, nextStart);

    nextStart = start + START_SPACING_MS;
    await sleep(start - now);

    try {
      return (
        await run('pnpm', ['exec', 'cf', ...args], {
          cwd: PACKAGE,
          maxBuffer: 64 * 1024 * 1024,
        })
      ).stdout;
    } catch (error) {
      const limited =
        error instanceof Error && RATE_LIMITED.test(error.message);

      if (attempt >= RETRIES || !limited) throw error;
      await sleep(BACKOFF_MS * 2 ** attempt);
    }
  }
}

const Listed = v.array(v.object({ key: v.string(), etag: v.string() }));

/** Every key under a prefix with its ETag, a page at a time. */
async function listKeys(
  bucket: string,
  prefix: string,
): Promise<Map<string, string>> {
  const keys = new Map<string, string>();
  let after: string | undefined;

  for (;;) {
    const page = v.parse(
      Listed,
      JSON.parse(
        await cf([
          'r2',
          'objects',
          'list',
          '--bucket-name',
          bucket,
          '--prefix',
          prefix,
          '--per-page',
          '1000',
          ...(after ? ['--start-after', after] : []),
        ]),
      ),
    );

    for (const { key, etag } of page) keys.set(key, etag);

    const last = page.at(-1)?.key;

    if (page.length < 1000 || last === undefined) return keys;
    after = last;
  }
}

const put = (
  bucket: string,
  key: string,
  file: string,
  dryRun = false,
): Promise<string> =>
  cf([
    'r2',
    'objects',
    'put',
    key,
    '--bucket-name',
    bucket,
    '--file',
    file,
    ...(contentTypeOf(key) ? ['--content-type', contentTypeOf(key) ?? ''] : []),
    ...(dryRun ? ['--dry-run'] : []),
  ]);

/** Runs `task` over `items`, `limit` at a time, failing on the first error. */
async function eachLimited<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items].reverse();

  const worker = async (): Promise<void> => {
    for (let item = queue.pop(); item !== undefined; item = queue.pop())
      await task(item);
  };

  await Promise.all(Array.from({ length: limit }, worker));
}

// oxlint-disable-next-line complexity -- one linear run of early exits; splitting it scatters the order of the checks
const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const id = args.find((arg) => !arg.startsWith('--')) ?? 'v1';

  const tag = snapshotTag(id);
  const line = SNAPSHOT_LINES.find((candidate) => candidate.id === id);

  if (!tag || !line) {
    console.error(
      `docs-snapshot-publish.ts: no versions.json entry with a tag for ${id}`,
    );
    process.exitCode = 2;

    return;
  }

  const root = join(workspaceRoot, snapshotPackage(id), 'dist');
  const dir = join(root, id);

  if (
    !existsSync(join(dir, 'index.html')) ||
    !existsSync(join(root, '_redirects'))
  ) {
    console.error(
      `docs-snapshot-publish.ts: ${relative(workspaceRoot, root)} holds no baked snapshot: run docs-snapshot.ts ${id}`,
    );
    process.exitCode = 2;

    return;
  }

  const pages: Record<string, string> = {};
  const missing: string[] = [];

  for (const file of await snapshotPages(dir)) {
    if (file === '404.html') continue;
    const canonical = canonicalOf(readFileSync(join(dir, file), 'utf8'));

    if (canonical === undefined) missing.push(file);
    else pages[`/${id}${htmlPath(file)}`] = canonical;
  }

  if (missing.length > 0) {
    console.error(
      `docs-snapshot-publish.ts: pages without a canonical link, run docs-snapshot.ts ${id} --bake-only:\n  ${missing.join('\n  ')}`,
    );
    process.exitCode = 1;

    return;
  }

  const manifest: SnapshotManifest = { tag, ...snapshotDigest(root), pages };
  const bucket = bucketName();
  const marker = markerBody(manifest);
  const target = manifestPath(id);

  const committed = existsSync(target) ? readSnapshotManifest(id) : undefined;
  const scratch = await mkdtemp(join(tmpdir(), 'docs-snapshot-publish-'));

  try {
    const markerFile = join(scratch, 'marker.json');

    await writeFile(markerFile, marker);

    const markerMd5 = md5Of(markerFile);
    const markerRemote = await listKeys(bucket, markerKey(id));

    if (
      committed?.sha256 === manifest.sha256 &&
      markerRemote.get(markerKey(id)) === markerMd5
    ) {
      console.log(
        `${bucket}: ${id} already holds ${manifest.sha256.slice(0, 12)}, as ${relative(workspaceRoot, target)} records; nothing to upload`,
      );

      return;
    }

    const files = lineFiles(root, line);
    const local = new Map(files.map((key) => [key, md5Of(join(root, key))]));
    const remote = new Map<string, string>();

    // A bare prefix also lists a sibling (`v1` lists `v10/`), so keep only the line's keys.
    for (const prefix of listPrefixes(line))
      for (const [key, etag] of await listKeys(bucket, prefix))
        if (ownsKey(line, key)) remote.set(key, etag);

    const plan = uploadPlan(local, remote);

    console.log(
      `${bucket}: ${id} ${manifest.sha256.slice(0, 12)}: ${plan.upload.length} to upload, ${plan.unchanged} unchanged, ${plan.stale.length} in the bucket but not the build (kept)`,
    );

    if (dryRun) {
      const [first] = plan.upload;

      if (first) console.log(await put(bucket, first, join(root, first), true));

      const { pages: listed, ...summary } = manifest;

      console.log(
        `dry run: would upload ${markerKey(id)} and write ${relative(workspaceRoot, target)}: ${JSON.stringify(summary)}, ${Object.keys(listed).length} pages`,
      );

      return;
    }

    let done = 0;

    await eachLimited(plan.upload, CONCURRENCY, async (key) => {
      await put(bucket, key, join(root, key));
      done += 1;

      if (done % 100 === 0) console.log(`  ${done}/${plan.upload.length}`);
    });

    // Last, so a record in the bucket always names a complete upload.
    await put(bucket, markerKey(id), markerFile);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `${relative(workspaceRoot, target)}: ${manifest.files} files, ${manifest.sha256}`,
  );
};

if (import.meta.main) await main();
