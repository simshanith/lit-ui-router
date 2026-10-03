import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  auditCoverage,
  formatCoverage,
  parseLintPatterns,
  scriptTasks,
} from './package-coverage.core.ts';

describe('parseLintPatterns', () => {
  it('reads the patterns past --format, unquoting them', () => {
    assert.deepEqual(
      parseLintPatterns(
        'eslint --format tap "**/package.json" pnpm-workspace.yaml',
      ),
      ['**/package.json', 'pnpm-workspace.yaml'],
    );
    assert.deepEqual(parseLintPatterns('eslint "**/package.json"'), [
      '**/package.json',
    ]);
  });

  it('throws on a command it does not fully understand', () => {
    assert.throws(() => parseLintPatterns('oxlint .'), /not an eslint call/);
    assert.throws(
      () => parseLintPatterns('eslint --ignore-pattern x "**/package.json"'),
      /unhandled eslint flag --ignore-pattern/,
    );
    assert.throws(
      () => parseLintPatterns('eslint --format tap'),
      /no file patterns/,
    );
  });
});

describe('auditCoverage', () => {
  const excluded = [{ file: 'b/package.json', why: 'own config' }];

  it('passes when linted equals tracked less the exclusions', () => {
    assert.deepEqual(
      auditCoverage(
        ['package.json', 'a/package.json', 'b/package.json'],
        ['package.json', 'a/package.json'],
        excluded,
      ),
      { missing: [], extra: [], stale: [] },
    );
  });

  it('names a tracked manifest that dropped out', () => {
    assert.deepEqual(
      auditCoverage(
        ['a/package.json', 'b/package.json', 'c/package.json'],
        ['c/package.json'],
        excluded,
      ).missing,
      ['a/package.json'],
    );
  });

  it('names a linted file that is untracked or excluded', () => {
    assert.deepEqual(
      auditCoverage(
        ['b/package.json'],
        ['b/package.json', 'tmp/package.json'],
        excluded,
      ).extra,
      ['b/package.json', 'tmp/package.json'],
    );
  });

  it('names an exclusion that is no longer tracked', () => {
    assert.deepEqual(auditCoverage([], [], excluded).stale, ['b/package.json']);
  });
});

describe('scriptTasks', () => {
  it('counts a task or any of its leaves, nothing else', () => {
    assert.deepEqual(
      [
        ...scriptTasks({
          build: 'x',
          'lint:oxlint': 'x',
          'format:check:oxfmt': 'x',
          testing: 'x',
          format: 'x',
        }),
      ],
      ['build', 'lint', 'format:check'],
    );
    assert.deepEqual([...scriptTasks(undefined)], []);
  });
});

describe('formatCoverage', () => {
  it('aligns columns under the header', () => {
    const [header, row] = formatCoverage([
      {
        dir: 'tools/x',
        name: '@tools/x',
        eslint: 'linted',
        member: 'member',
        catalog: true,
        tasks: new Set(['lint']),
      },
    ]);
    assert.ok(header && row);
    assert.equal(header.indexOf('eslint'), row.indexOf('linted'));
    assert.equal(header.indexOf('  lint  ') + 2, row.lastIndexOf('✓'));
  });
});
