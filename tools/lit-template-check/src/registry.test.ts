import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { registryFor } from './registry.ts';
import type { Definition } from './sites.ts';

const definition = (overrides: Partial<Definition>): Definition => ({
  tag: 'x-el',
  className: 'XEl',
  exported: true,
  topLevel: true,
  events: [],
  ...overrides,
});

describe('registryFor', () => {
  it('names a top-level class in the using file directly', () => {
    const { locals } = registryFor(
      '/r/a/src/a.ts',
      [
        {
          path: '/r/a/src/a.ts',
          definitions: [definition({ exported: false })],
        },
      ],
      new Set(),
    );

    assert.deepEqual(locals, [{ tag: 'x-el', type: 'XEl' }]);
  });

  it('imports an exported class from another file in the program', () => {
    const { locals } = registryFor(
      '/r/a/src/app/a.ts',
      [{ path: '/r/b/src/b.ts', definitions: [definition({})] }],
      new Set(['/r/b/src/b.ts']),
    );

    assert.deepEqual(locals, [
      { tag: 'x-el', type: 'import("../../../b/src/b.js").XEl' },
    ]);
  });

  it('ignores definitions outside the program', () => {
    const registry = registryFor(
      '/r/a/src/a.ts',
      [
        {
          path: '/r/b/src/b.ts',
          definitions: [definition({ events: ['go'] })],
        },
      ],
      new Set(),
    );

    assert.deepEqual(registry, { locals: [], events: [], unnameable: [] });
  });

  it('keeps the tag and events of a class no type can name', () => {
    const registry = registryFor(
      '/r/a/src/a.ts',
      [
        {
          path: '/r/b/src/b.ts',
          definitions: [definition({ exported: false, events: ['go', 'go'] })],
        },
      ],
      new Set(['/r/b/src/b.ts']),
    );

    assert.deepEqual(registry.locals, [{ tag: 'x-el' }]);
    assert.deepEqual(registry.events, [{ tag: 'x-el', names: ['go'] }]);
    assert.deepEqual(registry.unnameable, ['/r/b/src/b.ts#x-el']);
  });
});
