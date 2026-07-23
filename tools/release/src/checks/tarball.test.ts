import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { promisify } from 'node:util';

import { tarballManifest } from './tarball.ts';

const run = promisify(execFile);

describe('tarballManifest', () => {
  let dir: string;
  let tarball: string;
  const manifest = {
    name: 'probe',
    version: '1.0.0',
    files: ['dist/**'],
    _authorField: 'kept',
  };

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tarball-test-'));
    await mkdir(join(dir, 'package'));
    await writeFile(
      join(dir, 'package', 'package.json'),
      `${JSON.stringify(manifest)}\n`,
    );
    tarball = join(dir, 'probe.tgz');
    await run('tar', ['-czf', tarball, '-C', dir, 'package/package.json']);
  });

  after(() => rm(dir, { recursive: true, force: true }));

  it('returns the archived manifest fields verbatim, minus underscore metadata', async () => {
    // pacote drops author `_`-prefixed fields (npm-reserved namespace) and
    // the helper strips pacote's own injected fetch-metadata keys.
    const { _authorField, ...content } = manifest;
    assert.deepEqual(await tarballManifest(tarball), content);
  });

  it('rejects on a missing tarball (callers fail safe)', async () => {
    await assert.rejects(tarballManifest(join(dir, 'nope.tgz')));
  });

  // The gate consumes this helper: malformed manifests must fail the check
  // loudly, never normalize to a `{}` that absence-checks would pass.
  const malformed = async (label: string, bytes: string) => {
    const bad = await mkdtemp(join(tmpdir(), `tarball-${label}-`));
    await mkdir(join(bad, 'package'));
    await writeFile(join(bad, 'package', 'package.json'), bytes);
    const tgz = join(bad, 'bad.tgz');
    await run('tar', ['-czf', tgz, '-C', bad, 'package/package.json']);
    return tgz;
  };

  it('rejects an unparsable manifest', async () => {
    await assert.rejects(
      tarballManifest(await malformed('syntax', '{not json')),
    );
  });

  it('rejects a manifest that is not a package (array/empty object)', async () => {
    // pacote resolves these to metadata-only manifests; the name/version
    // assertion is what makes them loud.
    await assert.rejects(
      tarballManifest(await malformed('array', '[]')),
      /not a package manifest/,
    );
    await assert.rejects(
      tarballManifest(await malformed('empty', '{}')),
      /not a package manifest/,
    );
  });
});
