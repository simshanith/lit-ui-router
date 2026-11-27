import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { DefaultTheme } from 'vitepress';

import { entrySidebar } from '../reference-sidebar.ts';

const functions = (
  module: string,
  ...names: string[]
): DefaultTheme.SidebarItem => ({
  text: 'Functions',
  collapsed: true,
  items: names.map((name) => ({
    text: name,
    link: `/reference/pkg/${module}/functions/${name}.md`,
  })),
});

const moduleNode = (
  text: string,
  module: string,
  ...names: string[]
): DefaultTheme.SidebarItem => ({
  text,
  link: `/reference/pkg/${module}/`,
  collapsed: true,
  items: [functions(module, ...names)],
});

describe('entrySidebar', () => {
  it('titles each module by its import specifier, root first, kind groups flattened', () => {
    const sidebar = entrySidebar('pkg', [
      moduleNode('fetch', 'fetch', 'createFetchHandler'),
      moduleNode('index', 'index', 'createServerRouter'),
    ]);

    assert.deepEqual(
      sidebar.map(({ text, link }) => [text, link]),
      [
        ['pkg', '/reference/pkg/index/'],
        ['pkg/fetch', '/reference/pkg/fetch/'],
      ],
    );
    assert.deepEqual(
      sidebar[0]?.items?.map(({ text }) => text),
      ['createServerRouter'],
    );
  });

  it('lifts a nested module out of its folder node under its full name', () => {
    const sidebar = entrySidebar('pkg', [
      moduleNode('index', 'index', 'createServerRouter'),
      {
        text: 'router',
        collapsed: true,
        items: [
          moduleNode('matcher', 'router/matcher', 'createServerRouter'),
          {
            text: 'deep',
            collapsed: true,
            items: [moduleNode('entry', 'router/deep/entry', 'run')],
          },
        ],
      },
      moduleNode('vite', 'vite', 'serverRouterPlugin'),
    ]);

    assert.deepEqual(
      sidebar.map(({ text, link }) => [text, link]),
      [
        ['pkg', '/reference/pkg/index/'],
        ['pkg/router/matcher', '/reference/pkg/router/matcher/'],
        ['pkg/router/deep/entry', '/reference/pkg/router/deep/entry/'],
        ['pkg/vite', '/reference/pkg/vite/'],
      ],
    );
    assert.deepEqual(sidebar[1]?.items, [
      {
        text: 'createServerRouter',
        link: '/reference/pkg/router/matcher/functions/createServerRouter.md',
      },
    ]);
  });
});
