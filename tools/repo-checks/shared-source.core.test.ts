import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { statefulStatements, unexportedSources } from './shared-source.core.ts';

describe('statefulStatements', () => {
  it('allows imports, types, functions, ambient bindings and const functions or literals', () => {
    const source = [
      "import { a } from 'a';",
      "export { b } from 'b';",
      'export interface I { x: number }',
      'type T = string;',
      'export function f(): number { return 1; }',
      'const g = (): number => 2;',
      "export const NAME = 'x', LIMIT = -1, ON = true;",
      'declare const process: { env: Record<string, string> };',
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

describe('unexportedSources', () => {
  it('reports canonical sources no exports subpath names', () => {
    const exports = new Map([
      ['packages/shared/a', { '.': './src/a.ts', './b': './src/b.ts' }],
    ]);

    assert.deepEqual(
      unexportedSources(
        [
          'packages/shared/a/src/a.ts',
          'packages/shared/a/src/b.ts',
          'packages/shared/a/src/helper.ts',
        ],
        exports,
      ),
      ['packages/shared/a/src/helper.ts'],
    );
  });

  it('rejects an exports target that is not one file', () => {
    assert.throws(() =>
      unexportedSources(
        [],
        new Map([['packages/shared/a', { '.': { import: './src/a.ts' } }]]),
      ),
    );
  });
});
