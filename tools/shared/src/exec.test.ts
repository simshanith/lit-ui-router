import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { defaultCapture, defaultExec } from './exec.ts';

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
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /exited with code 3/);
        assert.equal((error as { stderr?: string }).stderr, 'nope');
        return true;
      },
    );
  });
});
