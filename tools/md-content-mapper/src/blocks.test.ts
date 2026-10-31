import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { extractBlocks } from './blocks.ts';

const fence = (info: string, body: string): string =>
  `\`\`\`${info}\n${body}\n\`\`\`\n`;

describe('extractBlocks', () => {
  it('keeps ts and typescript fences only', () => {
    const blocks = extractBlocks(
      [
        fence('ts', 'const a = 1;'),
        fence('typescript', 'const b = 2;'),
        fence('js', 'const c = 3;'),
        fence('sh', 'echo hi'),
      ].join('\n'),
    );

    assert.deepEqual(
      blocks.map((block) => block.lang),
      ['ts', 'typescript'],
    );
  });

  it('records fence lines and the meta after the language', () => {
    const [block] = extractBlocks(
      `# Title\n\n${fence('ts [main.ts] {2} check', 'a;\nb;')}`,
    );

    assert.equal(block.line, 3);
    assert.equal(block.endLine, 6);
    assert.equal(block.meta, '[main.ts] {2} check');
    assert.equal(block.skip, undefined);
  });

  it('checks a fence flagged check outside a title or highlight, and skips the rest', () => {
    const [flagged, titled, inTitle, inHighlight, unflagged] = extractBlocks(
      [
        fence('ts check', 'a;'),
        fence('ts [main.ts] check', 'b;'),
        fence('ts [check.ts]', 'c;'),
        fence('ts {check}', 'd;'),
        fence('ts', 'e;'),
      ].join('\n'),
    );

    assert.equal(flagged.skip, undefined);
    assert.equal(titled.skip, undefined);
    assert.equal(inTitle.skip, 'unflagged');
    assert.equal(inHighlight.skip, 'unflagged');
    assert.equal(unflagged.skip, 'unflagged');
  });

  it('skips an empty flagged fence', () => {
    assert.equal(extractBlocks(fence('ts check', ''))[0].skip, 'empty');
  });

  it('maps each line verbatim, past the indent a list strips', () => {
    const source = `- item\n\n  \`\`\`ts\n  const a = 1;\n\n  a;\n  \`\`\`\n`;
    const [block] = extractBlocks(source);

    assert.equal(block.text, 'const a = 1;\n\na;\n');

    for (const [virtual, length, original] of block.spans) {
      assert.equal(
        source.slice(original, original + length),
        block.text.slice(virtual, virtual + length),
      );
    }

    assert.equal(block.spans.length, 2);
  });

  it('maps blockquoted fences', () => {
    const source = `> \`\`\`ts\n> const q = 1;\n> \`\`\`\n`;
    const [block] = extractBlocks(source);
    const [[virtual, length, original]] = block.spans;

    assert.equal(source.slice(original, original + length), 'const q = 1;');
    assert.equal(virtual, 0);
  });
});
