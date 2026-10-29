import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { blockKey, transform } from './protocol.ts';

const packageDir = fileURLToPath(new URL('..', import.meta.url));

const source =
  '```ts\nconst a = 1;\n```\n\n```ts nocheck\nnope;\n```\n\n```ts\nb;\n```\n';

describe('transform', () => {
  it('emits an empty canonical output and one supplemental module per checked fence', () => {
    const result = transform({
      fileName: '/x.md',
      content: source,
      projectHandle: '1',
    });

    assert.equal(result.text, '');
    assert.deepEqual(
      result.supplemental?.map((output) => output.text),
      ['const a = 1;\n', 'b;\n'],
    );
    assert.deepEqual(result.supplemental?.[0].mappings, [[0, 12, 6, 12, 0]]);
  });

  it('leaves out the fences the skip option names', () => {
    const result = transform(
      { fileName: '/x.md', content: source, projectHandle: '1' },
      { skip: [blockKey('/x.md', 9)] },
    );

    assert.deepEqual(
      result.supplemental?.map((output) => output.text),
      ['const a = 1;\n'],
    );
  });
});

describe('tsc --runExternalCode', () => {
  it('reports a fence error at its Markdown position and never checks a nocheck fence', () => {
    const result = spawnSync(
      path.join(packageDir, 'node_modules', '.bin', 'tsc'),
      [
        '-p',
        'fixtures/tsconfig.json',
        '--runExternalCode',
        '--pretty',
        'false',
      ],
      { cwd: packageDir, encoding: 'utf8' },
    );

    assert.equal(
      result.stdout.trim(),
      "fixtures/control.md(6,9): error TS2322: Type 'string' is not assignable to type 'number'.",
    );
  });
});
