import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  attwGatingProblems,
  formatExportsReport,
  type PackageExportsCheck,
  publintGatingMessages,
} from './check-exports.core.ts';

describe('attwGatingProblems', () => {
  it('ignores node10 and node16-cjs resolutions (esm-only profile)', () => {
    const analysis = {
      types: {},
      problems: [
        { kind: 'NoResolution', entrypoint: '.', resolutionKind: 'node10' },
        {
          kind: 'CJSResolvesToESM',
          entrypoint: '.',
          resolutionKind: 'node16-cjs',
        },
      ],
    };
    assert.deepEqual(attwGatingProblems(analysis), []);
  });

  it('gates a broken node16-esm resolution', () => {
    const analysis = {
      types: {},
      problems: [
        {
          kind: 'NoResolution',
          entrypoint: './pure',
          resolutionKind: 'node16-esm',
        },
      ],
    };
    assert.deepEqual(attwGatingProblems(analysis), [
      {
        kind: 'NoResolution',
        entrypoint: './pure',
        resolutionKind: 'node16-esm',
      },
    ]);
  });

  it('gates a broken bundler resolution', () => {
    const analysis = {
      types: {},
      problems: [
        { kind: 'FalseESM', entrypoint: '.', resolutionKind: 'bundler' },
      ],
    };
    assert.equal(attwGatingProblems(analysis).length, 1);
  });

  it('gates a problem with no resolutionKind', () => {
    const analysis = {
      types: {},
      problems: [{ kind: 'InternalResolutionError' }],
    };
    assert.deepEqual(attwGatingProblems(analysis), [
      { kind: 'InternalResolutionError' },
    ]);
  });

  it('gates when the package ships no type declarations', () => {
    assert.deepEqual(attwGatingProblems({ types: false }), [
      { kind: 'NoTypeDeclarations' },
    ]);
  });

  it('passes a clean analysis', () => {
    assert.deepEqual(attwGatingProblems({ types: {}, problems: [] }), []);
  });
});

describe('publintGatingMessages', () => {
  it('passes when only suggestions are present', () => {
    assert.deepEqual(
      publintGatingMessages([{ type: 'suggestion', code: 'USE_LICENSE' }]),
      [],
    );
  });

  it('gates a warning', () => {
    const messages = [{ type: 'warning', code: 'EXPORTS_VALUE_INVALID' }];
    assert.deepEqual(publintGatingMessages(messages), messages);
  });

  it('gates an error', () => {
    const messages = [{ type: 'error', code: 'FILE_DOES_NOT_EXIST' }];
    assert.deepEqual(publintGatingMessages(messages), messages);
  });

  it('keeps only the gating messages from a mixed list', () => {
    const messages = [
      { type: 'suggestion', code: 'USE_LICENSE' },
      { type: 'warning', code: 'EXPORTS_VALUE_INVALID' },
      { type: 'error', code: 'FILE_DOES_NOT_EXIST' },
    ];
    assert.deepEqual(publintGatingMessages(messages), [
      { type: 'warning', code: 'EXPORTS_VALUE_INVALID' },
      { type: 'error', code: 'FILE_DOES_NOT_EXIST' },
    ]);
  });
});

describe('formatExportsReport', () => {
  const clean = (name: string, dir: string): PackageExportsCheck => ({
    name,
    dir,
    attw: [],
    publint: [],
    suggestions: [],
  });

  it('passes when every package is clean', () => {
    const { ok, text } = formatExportsReport([
      clean('lit-ui-router', 'packages/lit-ui-router'),
      clean('lit-ui-router-mobx', 'packages/lit-ui-router-mobx'),
    ]);
    assert.equal(ok, true);
    assert.match(text, /✓ exports check passed — 2 publishable packages/);
  });

  it('reports suggestions without gating', () => {
    const { ok, text } = formatExportsReport([
      {
        ...clean('lit-ui-router', 'packages/lit-ui-router'),
        suggestions: ['use "license"'],
      },
    ]);
    assert.equal(ok, true);
    assert.match(text, /✓ exports check passed/);
    assert.match(text, /publint suggestions \(not gating\)/);
    assert.match(text, /use "license"/);
  });

  it('fails and names the offending package for an attw problem', () => {
    const { ok, text } = formatExportsReport([
      clean('lit-ui-router', 'packages/lit-ui-router'),
      {
        name: 'lit-ui-router-mobx',
        dir: 'packages/lit-ui-router-mobx',
        attw: [
          {
            kind: 'NoResolution',
            entrypoint: './pure',
            resolutionKind: 'node16-esm',
          },
        ],
        publint: [],
        suggestions: [],
      },
    ]);
    assert.equal(ok, false);
    assert.match(text, /✗ exports check failed/);
    assert.match(text, /lit-ui-router-mobx \(packages\/lit-ui-router-mobx\)/);
    assert.match(text, /attw: NoResolution — \.\/pure \(node16-esm\)/);
    assert.doesNotMatch(text, /lit-ui-router \(packages\/lit-ui-router\)/);
  });

  it('fails and lists a publint violation', () => {
    const { ok, text } = formatExportsReport([
      {
        name: 'lit-ui-router',
        dir: 'packages/lit-ui-router',
        attw: [],
        publint: ['pkg.exports["."] is invalid'],
        suggestions: [],
      },
    ]);
    assert.equal(ok, false);
    assert.match(text, /publint: pkg\.exports\["\."\] is invalid/);
  });

  it('fails when no publishable packages were found', () => {
    const { ok, text } = formatExportsReport([]);
    assert.equal(ok, false);
    assert.match(text, /no publishable workspace packages/);
  });
});
