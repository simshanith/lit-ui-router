import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';

import { getAllByRole, getByRole, queryAllByRole } from '@testing-library/dom';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { parseHtml } from '@tools/lit-test-env/parse-html.ts';
import { createMarkdownRenderer } from 'vitepress';

import { readmeLinks, REPO_FILE_URL } from '../readme-links.ts';
import { SITE_ORIGIN } from '../versions.ts';

const SITE = join(import.meta.dirname, '../..');

const md = await createMarkdownRenderer(SITE, { config: readmeLinks });

/** A package page's body, rendered as VitePress renders it. */
const render = async (source: string) =>
  parseHtml(
    await md.renderAsync(source, {
      path: join(SITE, 'packages/page.md'),
      relativePath: 'packages/page.md',
      cleanUrls: true,
    }),
  ).body;

const link = async (source: string, name: string) =>
  getByRole(await render(source), 'link', { name });

describe('readmeLinks', () => {
  it('renders a link to this site as an in-site link', async () => {
    const page = await link(
      '[Guide](https://lit-ui-router.dev/guides/server#adapters)',
      'Guide',
    );

    assert.equal(page.getAttribute('href'), '/guides/server#adapters');
    assert.equal(page.getAttribute('target'), null);
    assert.equal(page.getAttribute('rel'), null);

    assert.equal(
      (await link('[Home](https://lit-ui-router.dev)', 'Home')).getAttribute(
        'href',
      ),
      '/',
    );
  });

  it('reloads for a path the worker serves', async () => {
    const releases = await link(
      '[Releases](https://lit-ui-router.dev/releases/ui-router-registry/)',
      'Releases',
    );

    assert.equal(
      releases.getAttribute('href'),
      '/releases/ui-router-registry/',
    );
    assert.equal(releases.getAttribute('target'), '_self');
  });

  it('reloads for a redirect source, which has no page', async () => {
    const moved = await link(
      '[Server](https://lit-ui-router.dev/packages/server)',
      'Server',
    );

    assert.equal(moved.getAttribute('href'), '/packages/server');
    assert.equal(moved.getAttribute('target'), '_self');
  });

  it('leaves another origin external', async () => {
    for (const url of [
      'https://atlas.lit-ui-router.dev/bricks/',
      'https://lit-ui-router.dev.example.com/guides/server',
    ]) {
      const other = await link(`[Other](${url})`, 'Other');

      assert.equal(other.getAttribute('href'), url);
      assert.equal(other.getAttribute('target'), '_blank');
    }
  });

  it('points a relative link in an included README at the repository', async () => {
    const page = await render(
      '<!--@include: ../../../packages/eslint-plugin-lit-ui-router/README.md-->\n\n[Sibling](./lit-ui-router)',
    );

    assert.deepEqual(
      getAllByRole(page, 'link', { name: 'anchor-is-valid' }).map((rule) =>
        rule.getAttribute('href'),
      )[0],
      `${REPO_FILE_URL}/packages/eslint-plugin-lit-ui-router/docs/rules/anchor-is-valid.md`,
    );
    assert.equal(
      getByRole(page, 'link', { name: '.oxlintrc.json' }).getAttribute('href'),
      `${REPO_FILE_URL}/.oxlintrc.json`,
    );
    // After the include ends, a relative link is the page's own.
    assert.equal(
      getByRole(page, 'link', { name: 'Sibling' }).getAttribute('href'),
      './lit-ui-router',
    );
  });

  it('resolves a bare relative image in an included README beside the README', async (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'readme-links-'));

    t.after(() => rmSync(dir, { recursive: true }));
    writeFileSync(
      join(dir, 'README.md'),
      '![bare](shot.png)\n\n![dotted](./shot.png)\n',
    );

    const beside = relative(join(SITE, 'packages'), dir);
    const page = await render(`<!--@include: ${beside}/README.md-->`);

    for (const name of ['bare', 'dotted'])
      assert.equal(
        getByRole(page, 'img', { name }).getAttribute('src'),
        `${beside}/shot.png`,
      );
  });

  it('leaves no included README link relative or on the site origin', async () => {
    for (const dir of readdirSync(join(workspaceRoot, 'packages'))) {
      if (dir === 'shared') continue;

      const page = await render(
        `<!--@include: ../../../packages/${dir}/README.md-->`,
      );

      // A root path or a fragment is in-site; anything else must name another origin.
      const stray = queryAllByRole(page, 'link')
        .map((anchor) => anchor.getAttribute('href') ?? '')
        .filter(
          (href) =>
            !/^[/#]/.test(href) &&
            (!URL.canParse(href) || new URL(href).origin === SITE_ORIGIN),
        );

      assert.deepEqual(stray, [], dir);
    }
  });
});
