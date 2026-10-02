import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatReport, packageRelative, rank } from './report.ts';

test('relativizes coverage keys from any checkout, local or CI', () => {
  for (const root of [
    '/Users/me/lit-ui-router',
    '/Users/me/lit-ui-router/.claude/worktrees/x',
    '/home/runner/work/lit-ui-router/lit-ui-router',
  ]) {
    assert.equal(
      packageRelative(
        `${root}/packages/lit-ui-router/src/core.ts`,
        'packages/lit-ui-router',
      ),
      'src/core.ts',
    );
  }
  assert.equal(
    packageRelative('/ci/packages/lit-ui-router', 'packages/lit-ui-router'),
    undefined,
  );
});

const fn = (
  file_path: string,
  qualified_name: string,
  complexity: number,
  coverage_percent: number,
  crap: number,
) => ({
  scored: {
    identity: { file_path, qualified_name, span: { start_line: 7 } },
    complexity,
    complexity_metric: 'cyclomatic',
    coverage_percent,
    crap: { value: crap, risk_level: 'low' },
  },
  threshold: 16,
  exceeds: crap > 16,
});

const analysis = JSON.stringify({
  result: {
    functions: [
      fn('a.ts', 'low', 1, 100, 1),
      fn('specs/a.spec.ts', 'spec', 9, 0, 90),
      fn('b.ts', 'risky', 11, 8, 104.2),
      fn('b.ts', 'complex', 14, 100, 14),
    ],
    summary: {},
    passed: false,
  },
});

const covered = new Set(['src/a.ts', 'src/b.ts']);

test('drops files the coverage run never instrumented', () => {
  const report = rank(analysis, 'src', covered);
  assert.deepEqual(
    report.hotspots.map((h) => h.name),
    ['risky', 'complex', 'low'],
  );
  assert.equal(report.files, 2);
  assert.equal(report.threshold, 16);
});

test('prints the top rows and flags those over threshold', () => {
  const out = formatReport('pkg', rank(analysis, 'src', covered), 2);
  assert.equal(
    out,
    [
      'pkg: 3 functions in 2 files, 1 over CRAP 16',
      '   CRAP  CC  COV  FUNCTION',
      '! 104.2  11   8%  risky  src/b.ts:7',
      '   14.0  14 100%  complex  src/b.ts:7',
    ].join('\n'),
  );
});

test('rejects a scorecard that lost a field', () => {
  assert.throws(() =>
    rank(JSON.stringify({ result: { functions: [{}] } }), 'src', covered),
  );
});
