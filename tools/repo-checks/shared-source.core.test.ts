import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { statefulStatements } from './shared-source.core.ts';

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
