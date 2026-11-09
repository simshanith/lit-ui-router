import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { registryFor } from './registry.ts';
import type { Definition } from './sites.ts';

const definition = (overrides: Partial<Definition>): Definition => ({
  tag: 'x-el',
  className: 'XEl',
  exported: true,
  topLevel: true,
  start: 0,
  tagStart: 0,
  events: [],
  slots: [],
  properties: [],
  attributes: [],
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

    assert.deepEqual(registry, {
      locals: [],
      events: [],
      attributes: [],
      unnameable: [],
      duplicates: [],
      slots: new Map(),
    });
  });

  it('collects the slots of the visible definition', () => {
    const { slots } = registryFor(
      '/r/a/src/a.ts',
      [
        {
          path: '/r/a/src/a.ts',
          definitions: [definition({ slots: ['', 'header'] })],
        },
      ],
      new Set(),
    );

    assert.deepEqual([...slots], [['x-el', ['', 'header']]]);
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

  describe('a tag two files define', () => {
    const a = '/r/p/src/a.ts';
    const b = '/r/p/src/b.ts';
    const app = '/r/p/src/app.ts';

    const defining = [
      { path: a, definitions: [definition({ className: 'A', start: 10 })] },
      {
        path: b,
        definitions: [
          definition({ className: 'B', start: 20, events: ['go'] }),
        ],
      },
    ];

    const program = new Set([a, b, app]);

    it('resolves to the using file own class', () => {
      assert.deepEqual(registryFor(a, defining, program).locals, [
        { tag: 'x-el', type: 'A' },
      ]);
      assert.deepEqual(registryFor(b, defining, program).locals, [
        { tag: 'x-el', type: 'B' },
      ]);
    });

    it('resolves to the class of an imported file', () => {
      const registry = registryFor(app, defining, program, new Set([b]));

      assert.deepEqual(registry.locals, [
        { tag: 'x-el', type: 'import("./b.js").B' },
      ]);
      assert.deepEqual(registry.events, [{ tag: 'x-el', names: ['go'] }]);
    });

    it('keeps every definition when neither is visible', () => {
      assert.deepEqual(registryFor(app, defining, program).locals, [
        { tag: 'x-el', type: 'import("./a.js").A' },
        { tag: 'x-el', type: 'import("./b.js").B' },
      ]);
    });

    it('reports the second definition once', () => {
      assert.deepEqual(registryFor(a, defining, program).duplicates, [
        { tag: 'x-el', path: b, start: 20, first: a },
      ]);
    });
  });
});
