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
      `# Title\n\n${fence('ts [main.ts] {2}', 'a;\nb;')}`,
    );

    assert.equal(block.line, 3);
    assert.equal(block.endLine, 6);
    assert.equal(block.meta, '[main.ts] {2}');
    assert.equal(block.skip, undefined);
  });

  it('skips a fence flagged nocheck, outside a title or highlight', () => {
    const [flagged, inTitle] = extractBlocks(
      [fence('ts nocheck', 'a;'), fence('ts [nocheck.ts]', 'b;')].join('\n'),
    );

    assert.equal(flagged.skip, 'nocheck');
    assert.equal(inTitle.skip, undefined);
  });

  it('skips an empty fence', () => {
    assert.equal(extractBlocks(fence('ts', ''))[0].skip, 'empty');
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
