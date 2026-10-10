import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  auditCopies,
  canonicalOf,
  expectedCopy,
  header,
  statefulStatements,
} from './shared-source.core.ts';

const CANONICAL = 'packages/shared/x/src/x.ts';

const SOURCE = 'export const x = 1;\n';

function audit(files: Record<string, string>, canonicals = [CANONICAL]) {
  const copies = new Map(
    Object.entries(files)
      .filter(([path]) => !canonicals.includes(path))
      .map(([path, text]) => [path, canonicalOf(text)]),
  );

  return auditCopies({
    copies,
    canonicals: new Set(canonicals),
    read: (path) => files[path] ?? '',
  });
}

describe('canonicalOf', () => {
  it('reads the path back out of the header', () => {
    assert.equal(canonicalOf(expectedCopy(CANONICAL, SOURCE)), CANONICAL);
  });

  it('is undefined without the header', () => {
    assert.equal(canonicalOf(SOURCE), undefined);
  });
});

describe('auditCopies', () => {
  it('passes a copy equal to header plus source', () => {
    assert.deepEqual(
      audit({
        [CANONICAL]: SOURCE,
        'packages/a/src/shared/x.ts': expectedCopy(CANONICAL, SOURCE),
      }),
      [],
    );
  });

  it('fails a drifted copy', () => {
    const [failure] = audit({
      [CANONICAL]: SOURCE,
      'packages/a/src/shared/x.ts': `${header(CANONICAL)}\nexport const x = 2;\n`,
    });

    assert.match(failure ?? '', /drifted/);
  });

  it('fails a file without the header', () => {
    const [failure] = audit({
      [CANONICAL]: SOURCE,
      'packages/a/src/shared/x.ts': expectedCopy(CANONICAL, SOURCE),
      'packages/a/src/shared/y.ts': SOURCE,
    });

    assert.match(failure ?? '', /no "\/\/ Copied from" header/);
  });

  it('fails a copy naming an unknown source', () => {
    const missing = 'packages/shared/y/src/y.ts';

    const [failure] = audit({
      [CANONICAL]: SOURCE,
      'packages/a/src/shared/x.ts': expectedCopy(CANONICAL, SOURCE),
      'packages/a/src/shared/y.ts': expectedCopy(missing, SOURCE),
    });

    assert.match(failure ?? '', /not a canonical source/);
  });

  it('fails a canonical source nobody copies', () => {
    assert.deepEqual(audit({ [CANONICAL]: SOURCE }), [
      `${CANONICAL}: no package holds a copy`,
    ]);
  });
});

describe('statefulStatements', () => {
  it('allows imports, types, functions and const functions or literals', () => {
    const source = [
      "import { a } from 'a';",
      "export { b } from 'b';",
      'export interface I { x: number }',
      'type T = string;',
      'export function f(): number { return 1; }',
      'const g = (): number => 2;',
      "export const NAME = 'x', LIMIT = -1, ON = true;",
    ].join('\n');

    assert.deepEqual(statefulStatements('ok.ts', source), []);
  });

  it('reports let, var, new, object bindings, classes and side effects', () => {
    const source = [
      'let a = 1;',
      'var b = 2;',
      'const c = new WeakMap();',
      'const d = {};',
      'const e = [];',
      'class F {}',
      'console.log(a);',
      'export default 1;',
    ].join('\n');

    assert.deepEqual(
      statefulStatements('bad.ts', source).map((line) => line.split(':')[1]),
      ['1', '2', '3', '4', '5', '6', '7', '8'],
    );
  });
});
