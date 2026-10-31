import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkExamples } from './check.ts';
import { formatDiagnostic } from './report.ts';

const packageDir = fileURLToPath(new URL('..', import.meta.url));

const run = (mode: 'opt-in' | 'opt-out') => {
  const { results, foreign } = checkExamples({
    root: packageDir,
    files: ['fixtures/control.ts'],
    mode,
    paths: new Map(),
  });

  return {
    foreign,
    statuses: results.map((r) => r.status),
    reported: results.flatMap((r) => r.diagnostics.map(formatDiagnostic)),
  };
};

describe('checkExamples', () => {
  it('reports an opted-in block error at its doc-comment line and column', () => {
    assert.deepEqual(run('opt-in'), {
      foreign: [],
      statuses: ['semantic', 'skipped', 'skipped', 'clean'],
      reported: [
        "fixtures/control.ts(5,12): error TS2322: Type 'string' is not assignable to type 'number'.",
      ],
    });
  });

  it('checks unflagged blocks under opt-out and never a nocheck block', () => {
    const { statuses, reported } = run('opt-out');

    assert.deepEqual(statuses, ['semantic', 'semantic', 'skipped', 'clean']);
    assert.deepEqual(
      reported.map((line) => line.split(':')[0]),
      ['fixtures/control.ts(5,12)', 'fixtures/control.ts(10,12)'],
    );
  });
});
