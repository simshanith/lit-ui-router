import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { type LedgerRow, parseLedger, planBackfill } from './backfill.core.ts';
import { extractSection, preamble } from './changelog.ts';

const row = (
  version: string,
  overrides: Partial<LedgerRow> = {},
): LedgerRow => ({
  name: 'pkg',
  version,
  gh_body: `### Features\n\n* ${version}\n`,
  gh_published_at: '2026-01-02T03:04:05Z',
  npm_published_at: '2026-01-02T03:04:00Z',
  ...overrides,
});

const ROWS = [
  row('1.0.0'),
  row('1.1.0', { gh_body: "## What's Changed\n* b" }),
  row('1.2.0-canary.1'),
  row('1.2.0-rc.0'),
  row('1.2.0', { gh_body: null, gh_published_at: null }),
  row('9.9.9', { name: 'other' }),
];

const FILE = { name: 'pkg', path: 'packages/pkg/CHANGELOG.md' };

describe('parseLedger', () => {
  it('reads GET /ledger’s body', () => {
    assert.deepEqual(
      parseLedger(JSON.stringify({ versions: ROWS, distTags: [] })),
      ROWS,
    );
  });

  it('reads a D1 query result', () => {
    assert.deepEqual(
      parseLedger(
        JSON.stringify([
          { results: ROWS.slice(0, 2) },
          { results: ROWS.slice(2) },
        ]),
      ),
      ROWS,
    );
  });

  it('throws on another shape', () => {
    assert.throws(() => parseLedger(JSON.stringify({ rows: ROWS })));
  });
});

describe('planBackfill', () => {
  const plan = planBackfill([{ ...FILE, text: undefined }], ROWS);
  const [pkg] = plan.packages;

  it('adds the stable releases with a stored body, newest first', () => {
    assert.deepEqual(pkg?.added, ['1.0.0', '1.1.0']);
    assert.equal(pkg?.changed, true);
    assert.match(pkg?.text ?? '', /^# Changelog\n/);
    assert.ok(
      (pkg?.text ?? '').indexOf('## 1.1.0 (2026-01-02)') <
        (pkg?.text ?? '').indexOf('## 1.0.0 (2026-01-02)'),
    );
  });

  it('reports a stable release with no stored body', () => {
    assert.deepEqual(pkg?.missing, ['1.2.0']);
  });

  it('normalises each body', () => {
    assert.equal(
      extractSection(pkg?.text ?? '', '1.1.0'),
      "### What's Changed\n* b",
    );
    assert.deepEqual(plan.transformations, {
      'demote-headings': 1,
      'trim-blank-lines': 1,
    });
    assert.deepEqual(plan.leadingHeadingStyles, {
      '### <section>': 1,
      '## <section>': 1,
    });
  });

  it('is a no-op on its own output', () => {
    const again = planBackfill([{ ...FILE, text: pkg?.text }], ROWS);

    assert.equal(again.packages[0]?.changed, false);
    assert.deepEqual(again.packages[0]?.added, []);
    assert.deepEqual(again.transformations, {});
  });

  it('adds only the missing section and keeps an edited one', () => {
    const edited = (pkg?.text ?? '').replace('* 1.0.0', '* 1.0.0, edited');

    const filled = planBackfill(
      [{ ...FILE, text: edited }],
      [...ROWS, row('1.2.0')],
    ).packages[0];

    assert.deepEqual(filled?.added, ['1.2.0']);
    assert.equal(
      extractSection(filled?.text ?? '', '1.0.0'),
      '### Features\n\n* 1.0.0, edited',
    );
  });

  it('writes the preamble alone for a package with no stable release', () => {
    const empty = planBackfill(
      [{ name: 'new', path: 'x', text: undefined }],
      ROWS,
    );

    assert.equal(empty.packages[0]?.text, `${preamble('new')}\n`);
  });
});
