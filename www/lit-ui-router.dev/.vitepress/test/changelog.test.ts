import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { getByRole, getByText, queryAllByRole } from '@testing-library/dom';
import { parseChangelog } from '@tools/changelog';
import { parseHtml } from '@tools/lit-test-env/parse-html.ts';

import { SIDEBAR } from '../../catalog/navigation.ts';
import { changelogPath, PACKAGES } from '../../catalog/packages.ts';
import {
  changelogContent,
  changelogFiles,
  changelogPage,
  changelogRoutes,
  changelogTransform,
  renderBody,
} from '../changelog.ts';
import { linkProblem, ORIGIN } from '../published-links.ts';
import { surfaceOf } from '../surfaces.ts';

const files = changelogFiles();

const pages = PACKAGES.map(({ name }) => {
  const file = files.get(name);

  assert.ok(file, `${name}: no CHANGELOG.md`);

  const text = readFileSync(file, 'utf8');

  return { name, text, page: changelogPage(name, text) };
});

describe('changelog pages', () => {
  it('builds every section of every changelog, each body rendering to elements', () => {
    const expected = pages.reduce(
      (count, { text }) => count + parseChangelog(text).sections.length,
      0,
    );

    const rendered = pages.flatMap(({ name, page }) =>
      page.sections.map((section) => ({ name, ...section })),
    );

    assert.equal(rendered.length, expected);
    assert.ok(rendered.length >= 158);

    for (const { name, version, html } of rendered) {
      const { body } = parseHtml(html);

      assert.ok(body.children.length > 0, `${name}@${version}: empty body`);
      assert.ok(body.textContent.trim(), `${name}@${version}: no text`);
    }
  });

  it('gives each section a v<version> anchor, unique on its page', () => {
    for (const { name, page } of pages) {
      const anchors = page.sections.map(({ anchor }) => anchor);

      assert.deepEqual(
        anchors,
        page.sections.map(({ version }) => `v${version}`),
      );
      assert.equal(new Set(anchors).size, anchors.length, name);
    }
  });

  it('leaves out a version with no section, with no placeholder', () => {
    const page = pages.find(({ name }) => name === 'lit-ui-router')?.page;
    const anchors = page?.sections.map(({ anchor }) => anchor) ?? [];

    assert.ok(anchors.includes('v1.4.0'));
    assert.ok(anchors.includes('v1.2.0'));
    assert.ok(!anchors.includes('v1.3.0'));
    assert.ok(!anchors.includes('v0.0.1'));
  });

  it('renders raw HTML and escaped angle brackets as GitHub does', () => {
    const page = pages.find(({ name }) => name === 'lit-ui-router')?.page;
    const section = page?.sections.find(({ version }) => version === '1.20.0');

    assert.ok(section);

    const { body } = parseHtml(section.html);
    const details = getByRole(body, 'group');

    assert.ok(getByText(details, 'Also touched this package (2)'));
    assert.ok(
      getByText(details, /move the API reference to \/reference\/<npm-name>\//),
    );
  });

  it('keeps every body out of the page source VitePress compiles', () => {
    for (const { page } of pages) {
      const content = changelogContent(page);

      assert.deepEqual(
        [...content.matchAll(/\{\{[\s\S]*?\}\}/g)].map(([match]) => match),
        ['{{ $params.llms }}'],
      );

      for (const { html } of page.sections) {
        assert.ok(!content.includes(html));
      }
    }
  });

  it('hands a body that looks like a Vue template to v-html as text', () => {
    const page = changelogPage(
      'lit-ui-router',
      '# Changelog\n\n## 9.0.0 (2030-01-01)\n\nUses {{ $params.pkg }} and <ui-view v-if="x"></ui-view> and \\<template>.\n',
    );

    const content = changelogContent(page);

    assert.ok(!content.includes('{{ $params.pkg }}'));
    assert.ok(!content.includes('ui-view'));
    assert.ok(content.includes(`v-html="$params['v9.0.0']"`));
    assert.match(
      parseHtml(page.sections[0]?.html ?? '').body.textContent,
      /Uses \{\{ \$params\.pkg \}\} and +and <template>\./,
    );
  });

  it('links the release page unless the body already does', () => {
    const page = changelogPage(
      'ui-router-server',
      [
        '# Changelog',
        '## 0.2.0 (2026-01-02)',
        '[Release page](https://lit-ui-router.dev/releases/ui-router-server/0.2.0/)',
        '## 0.1.0 (2026-01-01)',
        'First.',
      ].join('\n\n'),
    );

    assert.deepEqual(
      page.sections.map(({ release }) => release),
      [undefined, '/releases/ui-router-server/0.1.0/'],
    );
    assert.ok(
      changelogContent(page).includes(
        '[Release page](/releases/ui-router-server/0.1.0/){target="_self"}',
      ),
    );
  });

  it('builds a page with no sections for a package with no changelog yet', () => {
    const page = changelogPage('ui-router-registry');

    assert.deepEqual(page.sections, []);
    assert.ok(getByRole(parseHtml(page.preambleHtml).body, 'link'));
  });

  it('links the preamble to the package’s releases page on the same site', () => {
    for (const { name, page } of pages) {
      const link = getByRole(parseHtml(page.preambleHtml).body, 'link', {
        name: 'all releases',
      });

      assert.equal(
        link.getAttribute('href'),
        `/releases/${encodeURIComponent(name)}/`,
      );
      assert.equal(link.getAttribute('target'), '_self');
    }
  });

  it('keeps a site link on the serving deployment, leaving the client router docs pages', () => {
    const { body } = parseHtml(
      renderBody(
        '[a](https://lit-ui-router.dev/gh/x/) [b](https://lit-ui-router.dev/guides/x#y) [c](https://example.com/releases/)',
      ),
    );

    const [worker, page, external] = queryAllByRole(body, 'link');

    assert.equal(worker?.getAttribute('href'), '/gh/x/');
    assert.equal(worker?.getAttribute('target'), '_self');
    assert.equal(page?.getAttribute('href'), '/guides/x#y');
    assert.equal(page?.getAttribute('target'), null);
    assert.equal(
      external?.getAttribute('href'),
      'https://example.com/releases/',
    );
  });

  it('rejects a heading the parser contract does not allow', () => {
    assert.throws(
      () =>
        changelogPage('lit-ui-router', '# Changelog\n\n## Unreleased\n\nx\n'),
      /"## Unreleased"/,
    );
  });
});

describe('changelogRoutes', () => {
  it('routes every package, its params carrying each body under its anchor', () => {
    const routes = changelogRoutes(files);

    assert.deepEqual(
      routes.map(({ params }) => params.pkg),
      PACKAGES.map(({ name }) => name),
    );

    for (const { params } of routes) {
      const page = pages.find(({ name }) => name === params.pkg)?.page;

      for (const { anchor, html } of page?.sections ?? []) {
        assert.equal(params[anchor], html);
      }
    }
  });

  it('keeps the llms copy out of the page data the client loads', () => {
    const [route] = changelogRoutes(files);

    assert.ok(route);

    const transformed = changelogTransform({
      params: route.params,
      frontmatter: { type: 'reference' },
    });

    assert.equal(transformed.params?.llms, undefined);
    assert.equal(transformed.params?.pkg, 'lit-ui-router');

    const description =
      'Every stable release of lit-ui-router, newest first, with its release notes.';

    assert.equal(transformed.description, description);
    assert.equal(transformed.frontmatter?.description, description);
  });
});

describe('changelog catalog', () => {
  it('keeps every changelog out of the sidebar, in its own surface', () => {
    const links = (entries: typeof SIDEBAR): string[] =>
      entries.flatMap(({ link, items }) => [
        ...(link ? [link] : []),
        ...links(items ?? []),
      ]);

    const sidebar = links(SIDEBAR);

    for (const { name } of PACKAGES) {
      assert.ok(!sidebar.includes(changelogPath(name)), name);
      assert.equal(surfaceOf(changelogPath(name)).id, 'changelogs');
    }
  });

  it('passes a section anchor in the published-link check, and flags a missing one', async () => {
    assert.equal(
      await linkProblem(`${ORIGIN}/packages/lit-ui-router/changelog#v1.20.0`),
      undefined,
    );
    assert.equal(
      await linkProblem(`${ORIGIN}/packages/lit-ui-router/changelog#v1.3.0`),
      `${ORIGIN}/packages/lit-ui-router/changelog#v1.3.0: no section #v1.3.0 in the changelog`,
    );
  });

  it('links each package page to its changelog', () => {
    for (const { name } of PACKAGES) {
      const { body } = parseHtml(
        renderBody(
          readFileSync(
            new URL(`../../packages/${name}.md`, import.meta.url),
            'utf8',
          ),
        ),
      );

      assert.ok(
        queryAllByRole(body, 'link', { name: 'Changelog' }).some(
          (link) => link.getAttribute('href') === changelogPath(name),
        ),
        name,
      );
    }
  });
});
