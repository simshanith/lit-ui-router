import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { extractBlocks } from './blocks.ts';
import { attribute, brokenBlocks, parseDiagnostics } from './report.ts';

describe('attribute', () => {
  it('assigns each diagnostic to the fence whose lines hold it', () => {
    const blocks = extractBlocks(
      '```ts\nx;\n```\n\n```ts\ny(;\n```\n\n```ts\nz;\n```\n',
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
      ['syntax', 'syntax', 'clean'],
    );
    assert.deepEqual(
      attribute(blocksByFile, diagnostics).map((r) => r.status),
      ['semantic', 'semantic', 'clean'],
    );
  });
});
