import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  jsonOutput,
  withoutJsonFlags,
  writeJsonOutput,
} from './json-output.ts';

describe('jsonOutput', () => {
  it('writes no JSON without a flag or default', () => {
    assert.deepEqual(jsonOutput(['--verbose']), { kind: 'none' });
  });

  it('falls back to the default path without a flag', () => {
    assert.deepEqual(jsonOutput([], { defaultPath: '/d.json' }), {
      kind: 'file',
      path: '/d.json',
    });
  });

  it('sends --json to stdout, over a default', () => {
    assert.deepEqual(jsonOutput(['--json']), { kind: 'stdout' });
    assert.deepEqual(
      jsonOutput(['--json', '--verbose'], { defaultPath: '/d.json' }),
      { kind: 'stdout' },
    );
  });

  it('reads --json-out - as stdout', () => {
    assert.deepEqual(jsonOutput(['--json-out', '-']), { kind: 'stdout' });
  });

  it('takes the --json-out path, over a default', () => {
    assert.deepEqual(
      jsonOutput(['--json-out', '/o.json'], { defaultPath: '/d.json' }),
      { kind: 'file', path: '/o.json' },
    );
  });

  it('accepts --json with --json-out - as one destination', () => {
    assert.deepEqual(jsonOutput(['--json', '--json-out', '-']), {
      kind: 'stdout',
    });
  });

  it('rejects --json-out without a value', () => {
    assert.throws(() => jsonOutput(['--json-out']), /--json-out requires/);
    assert.throws(
      () => jsonOutput(['--json-out', '--strict']),
      /--json-out requires/,
    );
  });

  it('rejects --json alongside a --json-out file', () => {
    assert.throws(
      () => jsonOutput(['--json', '--json-out', '/o.json']),
      /one destination/,
    );
  });

  it('points a path after --json at --json-out', () => {
    assert.throws(
      () => jsonOutput(['--json', '/o.json'], { defaultPath: '/d.json' }),
      /--json takes no value.*--json-out \/o\.json/,
    );
  });

  it('leaves an argument after --json to a script with positionals', () => {
    assert.deepEqual(
      jsonOutput(['--json', 'http://localhost:8787'], { positionals: true }),
      { kind: 'stdout' },
    );
  });
});

describe('withoutJsonFlags', () => {
  it('drops --json, --json-out and its value', () => {
    assert.deepEqual(
      withoutJsonFlags(['--json-out', 'a.json', 'http://x', '--json']),
      ['http://x'],
    );
  });

  it('keeps arguments without the flags', () => {
    assert.deepEqual(withoutJsonFlags(['http://x', '--strict']), [
      'http://x',
      '--strict',
    ]);
  });
});

describe('writeJsonOutput', () => {
  it('writes the file, creating its directory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'json-output-'));

    try {
      const path = join(dir, '.cache', 'out.json');
      await writeJsonOutput({ kind: 'file', path }, '{}\n');
      assert.equal(await readFile(path, 'utf8'), '{}\n');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('writes nothing for none', async () => {
    await writeJsonOutput({ kind: 'none' }, '{}\n');
  });
});
