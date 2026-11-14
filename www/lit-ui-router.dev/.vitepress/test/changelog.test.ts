import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { getByRole, getByText, queryAllByRole } from '@testing-library/dom';
import { parseChangelog, preamble } from '@tools/changelog';
import { parseHtml } from '@tools/lit-test-env/parse-html.ts';
import * as v from 'valibot';

import { PACKAGES } from '../../catalog/packages.ts';
import { notesAsset } from '../../worker/releases/notes.ts';
import {
  changelogAssets,
  changelogFiles,
  changelogMarkdownPath,
  changelogText,
  releaseNotes,
  renderBody,
} from '../changelog.ts';
import { LLMS_RELEASES } from '../llms.ts';
import { surfaceOf } from '../surfaces.ts';

const files = changelogFiles();

const changelogs = PACKAGES.map(({ name }) => {
  assert.ok(files.has(name), `${name}: no CHANGELOG.md`);

  const text = changelogText(name, files);

  return { name, text, notes: releaseNotes(name, text) };
});

const Notes = v.record(
  v.string(),
  v.strictObject({
    date: v.pipe(v.string(), v.isoDate()),
    html: v.string(),
  }),
);

describe('release notes', () => {
  it('builds every section of every changelog, each body rendering to elements', () => {
    const expected = changelogs.reduce(
      (count, { text }) => count + parseChangelog(text).sections.length,
      0,
    );

    const rendered = changelogs.flatMap(({ name, notes }) =>
      Object.entries(notes).map(([version, note]) => ({
        name,
        version,
        html: note?.html ?? '',
      })),
    );

    assert.equal(rendered.length, expected);
    assert.ok(rendered.length >= 158);

    for (const { name, version, html } of rendered) {
      const { body } = parseHtml(html);

      assert.ok(body.children.length > 0, `${name}@${version}: empty body`);
      assert.ok(body.textContent.trim(), `${name}@${version}: no text`);
    }
  });

  it("keys each section by its version, with its heading's date", () => {
    const notes = changelogs.find(
      ({ name }) => name === 'lit-ui-router',
    )?.notes;

    assert.ok(notes);
    assert.match(notes['1.20.0']?.date ?? '', /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(notes['1.2.0']);
    assert.equal(notes['1.3.0'], undefined);
    assert.equal(notes['0.0.1'], undefined);
  });

  it('renders raw HTML and escaped angle brackets as GitHub does', () => {
    const html =
      changelogs.find(({ name }) => name === 'lit-ui-router')?.notes['1.20.0']
        ?.html ?? '';

    const details = getByRole(parseHtml(html).body, 'group');

    assert.ok(getByText(details, 'Also touched this package (2)'));
    assert.ok(
      getByText(details, /move the API reference to \/reference\/<npm-name>\//),
    );
  });

  it('keeps a body that looks like a template as text', () => {
    const notes = releaseNotes(
      'lit-ui-router',
      '# Changelog\n\n## 9.0.0 (2030-01-01)\n\nUses {{ $params.pkg }} and \\<template>.\n',
    );

    assert.match(
      parseHtml(notes['9.0.0']?.html ?? '').body.textContent,
      /Uses \{\{ \$params\.pkg \}\} and <template>\./,
    );
  });

  it('has no sections for a package with no changelog yet', () => {
    assert.deepEqual(
      releaseNotes('ui-router-registry', preamble('ui-router-registry')),
      {},
    );
    assert.equal(
      changelogText('ui-router-registry', new Map()),
      preamble('ui-router-registry'),
    );
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
        releaseNotes('lit-ui-router', '# Changelog\n\n## Unreleased\n\nx\n'),
      /"## Unreleased"/,
    );
  });

  it('rejects a repeated version', () => {
    assert.throws(
      () =>
        releaseNotes(
          'lit-ui-router',
          '# Changelog\n\n## 1.0.0 (2026-01-01)\n\nx\n\n## 1.0.0 (2026-01-02)\n\ny\n',
        ),
      /two 1\.0\.0 sections/,
    );
  });
});

describe('changelog assets', () => {
  const assets = changelogAssets(files);

  it("emits each catalog package's notes as JSON for the worker, and its changelog as Markdown", () => {
    assert.deepEqual(
      assets.map(({ fileName }) => fileName),
      PACKAGES.flatMap(({ name }) => [
        `releases/_notes/${name}.json`,
        `changelogs/${name}.md`,
      ]),
    );

    for (const { name, text, notes } of changelogs) {
      const json = assets.find(
        ({ fileName }) => `/${fileName}` === notesAsset(name),
      );

      const markdown = assets.find(
        ({ fileName }) => `/${fileName}` === changelogMarkdownPath(name),
      );

      assert.deepEqual(v.parse(Notes, JSON.parse(json?.source ?? '')), notes);
      assert.equal(markdown?.source, text);
    }
  });

  it('keeps the notes inside the releases mount, where a request gets the 404 page', () => {
    for (const { name } of PACKAGES) {
      assert.equal(surfaceOf(notesAsset(name)).id, 'releases');
    }
  });

  it('lists every Markdown changelog in the llms.txt Releases section', () => {
    for (const { name } of PACKAGES) {
      const path = changelogMarkdownPath(name);

      assert.equal(surfaceOf(path).id, 'changelogs');
      assert.ok(LLMS_RELEASES.includes(`(https://lit-ui-router.dev${path})`));
    }
  });

  it('links each package page to its releases page', () => {
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
        queryAllByRole(body, 'link', { name: 'Releases' }).some(
          (link) => link.getAttribute('href') === `/releases/${name}/`,
        ),
        name,
      );
    }
  });
});
