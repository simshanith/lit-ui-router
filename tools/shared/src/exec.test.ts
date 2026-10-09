import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { defaultCapture, defaultExec, readExecFailure } from './exec.ts';

// Past defaultExec's 16 MiB ceiling, so the pair's difference is the assertion.
const BIG = 17 * 1024 * 1024;

const emit = (bytes: number) => `process.stdout.write('x'.repeat(${bytes}))`;

describe('defaultCapture', () => {
  it('captures output past the ceiling defaultExec rejects at', async () => {
    const { stdout } = await defaultCapture(process.execPath, [
      '-e',
      emit(BIG),
    ]);

    assert.equal(stdout.length, BIG);

    await assert.rejects(
      defaultExec(process.execPath, ['-e', emit(BIG)]),
      /maxBuffer/,
    );
  });

  it('rejects with stderr attached, as callers read it', async () => {
    await assert.rejects(
      defaultCapture(process.execPath, [
        '-e',
        "process.stderr.write('nope'); process.exit(3)",
      ]),
      (error: Error & { stderr?: string }) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /exited with code 3/);
        assert.equal(error.stderr, 'nope');

        return true;
      },
    );
  });
});

describe('readExecFailure', () => {
  it('reads the code and output a rejected exec carries', async () => {
    const cause = await defaultExec(process.execPath, [
      '-e',
      "process.stdout.write('out'); process.stderr.write('err'); process.exit(3)",
    ]).catch((cause: unknown) => cause);

    assert.deepEqual(readExecFailure(cause), {
      code: 3,
      stdout: 'out',
      stderr: 'err',
    });
  });

  it('drops mistyped fields and reads a non-object as empty', () => {
    const spawnFailure = Object.assign(new Error('spawn nope ENOENT'), {
      code: 'ENOENT',
    });

    const failure = readExecFailure(spawnFailure);

    assert.equal(failure.code, undefined);
    assert.equal(failure.stderr, undefined);
    assert.deepEqual(readExecFailure(null), {});
    assert.deepEqual(readExecFailure('boom'), {});
  });
});
