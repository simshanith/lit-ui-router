import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';

import { getByRole } from '@testing-library/dom';
import { parseHtml } from '@tools/lit-test-env/parse-html.ts';
import type { DefaultTheme } from 'vitepress';

import { SIDEBAR } from '../../catalog/navigation.ts';
import { PACKAGES } from '../../catalog/packages.ts';
import {
  packageLabelHtml,
  splitFamilyPrefix,
  withPackageLabels,
} from '../package-label.ts';

const flat = (
  items: readonly DefaultTheme.SidebarItem[],
): DefaultTheme.SidebarItem[] =>
  items.flatMap((item) => [item, ...flat(item.items ?? [])]);

/** The label as VitePress's sidebar link holds it, parsed. */
const link = (html: string) =>
  getByRole(
    parseHtml(`<a href="/"><p><bdi>${html}</bdi></p></a>`).body,
    'link',
  );

describe('splitFamilyPrefix', () => {
  it('splits the family prefix from the rest of each package name', () => {
    assert.deepEqual(
      PACKAGES.map(({ name }) => splitFamilyPrefix(name)),
      [
        ['', 'lit-ui-router'],
        ['ui-router-', 'effect'],
        ['lit-ui-router-', 'effect'],
        ['ui-router-', 'mobx'],
        ['lit-ui-router-', 'mobx'],
        ['ui-router-', 'signals'],
        ['lit-ui-router-', 'signals'],
        ['ui-router-', 'navigation-location-plugin'],
        ['ui-router-', 'server'],
        ['lit-ui-router-', 'ssr'],
        ['ui-router-', 'registry'],
        ['', 'eslint-plugin-lit-ui-router'],
        ['ui-router-', 'otel'],
      ],
    );
  });
});

describe('packageLabelHtml', () => {
  it('names the link by the whole npm name, the rest in its own element', () => {
    for (const { name } of PACKAGES) {
      const [prefix, rest] = splitFamilyPrefix(name);
      const anchor = link(packageLabelHtml(name));

      assert.equal(anchor.textContent, name);
      // The marked-up part has no role, so no role query reaches it.
      const marked = anchor.querySelector('.package-name-rest');

      assert.equal(marked?.textContent, rest);
      assert.equal(marked?.previousSibling?.textContent ?? '', prefix);
    }
  });
});

/** Entries the catalog does not hold: an entry point's label, and a label with a footer name of its own. */
const EXTRA: DefaultTheme.SidebarItem[] = [
  { text: 'ui-router-server/vite', link: '/reference/ui-router-server/vite/' },
  { text: 'Overview', link: '/elsewhere/', docFooterText: 'Elsewhere' },
];

describe('withPackageLabels', () => {
  const marked = flat(withPackageLabels([...SIDEBAR, ...EXTRA]));

  const plain = (text: string) => marked.find((item) => item.text === text);

  it('marks up every package label and keeps its plain name for the page footer', () => {
    const labelled = marked.flatMap(({ text = '', docFooterText = '' }) =>
      /[<>]/.test(text) ? [{ text, docFooterText }] : [],
    );

    assert.deepEqual(
      [...new Set(labelled.map(({ docFooterText }) => docFooterText))].sort(),
      [...PACKAGES.map(({ name }) => name), 'ui-router-server/vite'].sort(),
    );

    for (const { text, docFooterText } of labelled) {
      assert.equal(link(text).textContent, docFooterText);
    }
  });

  it('keeps the footer name an entry already carries', () => {
    assert.equal(
      marked.find(({ link: href }) => href === '/elsewhere/')?.docFooterText,
      'Elsewhere',
    );
  });

  it('leaves the family hubs and every other label alone', () => {
    for (const text of ['Effect', 'MobX', 'Signals', 'Server', 'Overview']) {
      assert.ok(plain(text), text);
    }
  });

  it('keeps each entry its link and children', () => {
    assert.deepEqual(
      marked.map(({ link: href }) => href),
      flat([...SIDEBAR, ...EXTRA]).map(({ link: href }) => href),
    );
  });
});

describe('the catalog sidebar', () => {
  it('holds no markup, so llms.txt reads its labels as they are', () => {
    assert.deepEqual(
      flat(SIDEBAR).flatMap(({ text = '' }) =>
        /[<>]/.test(text) ? [text] : [],
      ),
      [],
    );
  });
});

describe('VitePress', () => {
  it('renders sidebar text as HTML', () => {
    const component = readFileSync(
      join(
        dirname(
          createRequire(import.meta.url).resolve('vitepress/package.json'),
        ),
        'dist/client/theme-default/components/VPSidebarItem.vue',
      ),
      'utf8',
    );

    assert.ok(component.includes('<bdi v-html="item.text" />'));
  });
});
