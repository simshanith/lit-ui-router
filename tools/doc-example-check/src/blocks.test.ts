import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { commentLines, extractFences } from './blocks.ts';

const source = [
  '/**',
  ' * @example Caption',
  ' * ```ts',
  ' * if (x) {',
  ' *   y();',
  ' * }',
  ' * ```',
  ' */',
].join('\n');

const tag = source.indexOf('@example');

describe('commentLines', () => {
  it('strips the gutter and keeps each line its source position', () => {
    assert.deepEqual(commentLines(source, tag, source.length).slice(0, 4), [
      { line: 2, column: 3, text: '@example Caption' },
      { line: 3, column: 3, text: '```ts' },
      { line: 4, column: 3, text: 'if (x) {' },
      { line: 5, column: 3, text: '  y();' },
    ]);
  });

  it('stops at the closing delimiter', () => {
    assert.deepEqual(commentLines(source, tag, source.length).at(-1), {
      line: 8,
      column: 0,
      text: '',
    });
  });
});

describe('extractFences', () => {
  const lines = commentLines(source, tag, source.length);

  it('maps each block line to its source line and column', () => {
    const { blocks } = extractFences(lines, 'opt-out');

    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].text, 'if (x) {\n  y();\n}\n');
    assert.deepEqual(blocks[0].lines, [
      { line: 4, column: 3 },
      { line: 5, column: 3 },
      { line: 6, column: 3 },
    ]);
    assert.equal(blocks[0].skip, undefined);
  });

  it('skips an unflagged block under opt-in', () => {
    assert.equal(extractFences(lines, 'opt-in').blocks[0].skip, 'unflagged');
  });

  it('reads flags outside a vitepress title only', () => {
    const flagged = (info: string) =>
      extractFences(
        [
          { line: 1, column: 0, text: `\`\`\`${info}` },
          { line: 2, column: 0, text: 'x;' },
          { line: 3, column: 0, text: '```' },
        ],
        'opt-in',
      ).blocks[0].skip;

    assert.equal(flagged('ts check'), undefined);
    assert.equal(flagged('ts [check]'), 'unflagged');
    assert.equal(flagged('ts check nocheck'), 'nocheck');
  });

  it('ignores fences in other languages', () => {
    assert.deepEqual(
      extractFences(
        [
          { line: 1, column: 0, text: '```html' },
          { line: 2, column: 0, text: '<a></a>' },
          { line: 3, column: 0, text: '```' },
        ],
        'opt-out',
      ),
      { blocks: [], fenced: true },
    );
  });
});
