import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { XMLParser } from 'fast-xml-parser';
import { SyntaxValidator } from 'fast-xml-validator';
import * as v from 'valibot';

import '../dom-shim.ts';
import type { ReleaseDiffs } from '../releases/diff-data.ts';
import type { LedgerReader, LedgerVersion } from '../releases/ledger.ts';
import { serveReleases } from '../releases/serve.ts';
import { MAX_URLS, sitemapEntries, sitemapXml } from '../releases/sitemap.ts';
import { FIXTURE_ROWS, fixtureLedger } from './ledger-stub/rows.ts';
import { memoryEdge } from './memory-cache.ts';

const ORIGIN = 'http://docs.test';

const SITEMAP = '/releases/sitemap.xml';

const NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';

const unread = () => Promise.reject(new Error('read a diff'));

const NO_DIFFS: ReleaseDiffs = { index: unread, files: unread, patch: unread };

const serve = (path: string, init?: RequestInit, ledger = fixtureLedger) =>
  serveReleases(new Request(`${ORIGIN}${path}`, init), ledger, NO_DIFFS);

const parser = new XMLParser({
  ignoreAttributes: false,
  ignoreDeclaration: true,
  parseTagValue: false,
  isArray: (name) => name === 'url',
});

const ParsedSitemap = v.strictObject({
  urlset: v.strictObject({
    '@_xmlns': v.literal(NS),
    url: v.array(
      v.strictObject({ loc: v.string(), lastmod: v.optional(v.string()) }),
    ),
  }),
});

/** A sitemap's `<url>` entries, from the parsed XML; invalid XML fails the test. */
const urlsOf = (xml: string) => {
  assert.equal(SyntaxValidator.validate(xml), true);

  return v.parse(ParsedSitemap, parser.parse(xml)).urlset.url;
};

const sitemap = async (ledger = fixtureLedger) => {
  const response = await serve(SITEMAP, undefined, ledger);

  assert.equal(response?.status, 200);

  return urlsOf((await response?.text()) ?? '');
};

const PUBLISHED = new Date(
  FIXTURE_ROWS[0]?.npm_published_at ?? NaN,
).toISOString();

describe('the /releases sitemap', () => {
  it('answers with XML the edge may keep', async () => {
    const response = await serve(SITEMAP);

    assert.equal(response?.status, 200);
    assert.equal(
      response?.headers.get('Content-Type'),
      'application/xml; charset=utf-8',
    );
    assert.equal(
      response?.headers.get('Cache-Control'),
      'public, max-age=3600',
    );
  });

  it('lists the index, then each package page followed by its versions, newest first', async () => {
    assert.deepEqual(
      (await sitemap()).map(({ loc }) => loc),
      [
        '/releases/',
        '/releases/lit-ui-router/',
        '/releases/lit-ui-router/1.11.0-rc.0/',
        '/releases/lit-ui-router/1.10.0/',
        '/releases/lit-ui-router/1.9.0/',
        '/releases/lit-ui-router/1.2.0/',
        '/releases/ui-router-server/',
        '/releases/ui-router-server/0.3.0/',
      ].map((path) => `${ORIGIN}${path}`),
    );
  });

  it('lists only pages that answer 200, and no diff page', async () => {
    for (const { loc } of await sitemap()) {
      const path = new URL(loc).pathname;

      assert.doesNotMatch(path, /\/diff(\/|$)/);
      assert.equal((await serve(path))?.status, 200, path);
    }
  });

  it("dates each version by its publish, and each listing by its newest version's", async () => {
    const npm = '2026-03-01T00:00:00Z';
    const gh = '2026-04-01T00:00:00.000Z';

    const dated = (row: LedgerVersion): LedgerVersion =>
      row.version === '1.10.0'
        ? { ...row, npm_published_at: null, gh_published_at: gh }
        : row.version === '1.9.0'
          ? { ...row, npm_published_at: npm }
          : row.version === '1.2.0'
            ? { ...row, npm_published_at: null, gh_published_at: null }
            : row;

    const ledger: LedgerReader = {
      ...fixtureLedger,
      versions: async (name) => (await fixtureLedger.versions(name)).map(dated),
    };

    const lastmods = new Map(
      (await sitemap(ledger)).map(({ loc, lastmod }) => [
        new URL(loc).pathname,
        lastmod,
      ]),
    );

    assert.equal(lastmods.get('/releases/lit-ui-router/1.10.0/'), gh);
    assert.equal(
      lastmods.get('/releases/lit-ui-router/1.9.0/'),
      '2026-03-01T00:00:00.000Z',
    );
    assert.equal(lastmods.get('/releases/lit-ui-router/1.2.0/'), undefined);
    assert.equal(
      lastmods.get('/releases/lit-ui-router/1.11.0-rc.0/'),
      PUBLISHED,
    );
    assert.equal(
      lastmods.get('/releases/lit-ui-router/'),
      [gh, PUBLISHED].sort().at(-1),
    );
    assert.equal(lastmods.get('/releases/ui-router-server/'), PUBLISHED);
    assert.equal(lastmods.get('/releases/'), [gh, PUBLISHED].sort().at(-1));
  });

  it('escapes markup in a loc', () => {
    const path = '/releases/?a=<1>&b="2"';

    assert.deepEqual(
      urlsOf(sitemapXml(ORIGIN, [{ path }])).map(({ loc }) => loc),
      [`${ORIGIN}${path}`],
    );
  });

  it('stops at the protocol limit of 50,000 urls', () => {
    const row = FIXTURE_ROWS[0];
    assert.ok(row);

    const versions = Array.from({ length: MAX_URLS }, (_, at) => ({
      ...row,
      version: `0.0.${at}`,
    }));

    const entries = sitemapEntries(
      [{ name: row.name, latest: null }],
      [versions],
    );

    assert.equal(entries.length, MAX_URLS);
    assert.equal(entries.at(-1)?.path, `/releases/${row.name}/0.0.49997/`);
  });

  it('answers HEAD with headers and no body', async () => {
    const response = await serve(SITEMAP, { method: 'HEAD' });

    assert.equal(response?.status, 200);
    assert.equal(
      response?.headers.get('Content-Type'),
      'application/xml; charset=utf-8',
    );
    assert.equal(response?.body, null);
  });

  it('answers 503 while the ledger cannot be read, and keeps no copy', async () => {
    const down = () => Promise.reject(new Error('ledger down'));
    const memory = memoryEdge();

    const response = await serveReleases(
      new Request(`${ORIGIN}${SITEMAP}`),
      { packages: down, tagged: down, versions: down },
      NO_DIFFS,
      memory.edge,
    );

    await memory.settled();

    assert.equal(response?.status, 503);
    assert.equal(response?.headers.get('Cache-Control'), 'no-store');
    assert.equal(memory.entries.size, 0);
  });

  it('serves a fresh copy from the edge without reading the ledger', async () => {
    const memory = memoryEdge();

    const via = (ledger: LedgerReader) =>
      serveReleases(
        new Request(`${ORIGIN}${SITEMAP}`),
        ledger,
        NO_DIFFS,
        memory.edge,
      );

    await via(fixtureLedger);
    await memory.settled();

    const unreachable = () => Promise.reject(new Error('read the ledger'));

    const response = await via({
      packages: unreachable,
      tagged: unreachable,
      versions: unreachable,
    });

    assert.equal(response?.status, 200);
    assert.equal(urlsOf((await response?.text()) ?? '').length, 8);
  });
});
