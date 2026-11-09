import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { extractBlocks } from './blocks.ts';
import {
  attribute,
  brokenBlocks,
  parseDiagnostics,
  summarize,
} from './report.ts';

describe('attribute', () => {
  it('assigns each diagnostic to the fence whose lines hold it', () => {
    const blocks = extractBlocks(
      '```ts check\nx;\n```\n\n```ts check\ny(;\n```\n\n```ts check\nz;\n```\n\n```ts\nw;\n```\n',
    );

    const diagnostics = parseDiagnostics(
      [
        "a.md(2,1): error TS2304: Cannot find name 'x'.",
        'a.md(6,3): error TS1109: Expression expected.',
        "b.md(10,1): error TS2304: Cannot find name 'z'.",
      ].join('\n'),
    );

    const blocksByFile = new Map([['a.md', blocks]]);

    const broken = brokenBlocks(blocksByFile, diagnostics);

    assert.deepEqual([...broken], ['a.md:1', 'a.md:5']);
    assert.deepEqual(
      attribute(blocksByFile, diagnostics, broken).map((r) => r.status),
      ['syntax', 'syntax', 'clean', 'skipped'],
    );
    assert.deepEqual(
      attribute(blocksByFile, diagnostics).map((r) => r.status),
      ['semantic', 'semantic', 'clean', 'skipped'],
    );

    const summary = summarize(attribute(blocksByFile, diagnostics, broken));

    assert.match(summary, /^blocks skipped: 1 \(unflagged 1\)$/m);
    assert.match(summary, /^blocks checked: 3 of 4$/m);
  });
});
