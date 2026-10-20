import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import '../dom-shim.ts';
import { releaseDocument, STYLESHEET } from '../releases/document.ts';
import {
  type LedgerReader,
  latestVersionOf,
  NotInLedger,
  versionIn,
  versionsOf,
} from '../releases/ledger.ts';
import { serveReleases } from '../releases/serve.ts';
import { fixtureLedger } from './ledger-stub/rows.ts';

const ORIGIN = 'http://docs.test';

const serve = (path: string, init?: RequestInit, ledger = fixtureLedger) =>
  serveReleases(new Request(`${ORIGIN}${path}`, init), ledger);

const DOWN: LedgerReader = {
  packages: () => Promise.reject(new Error('ledger down')),
  tagged: () => Promise.reject(new Error('ledger down')),
  versions: () => Promise.reject(new Error('ledger down')),
};

describe('the ledger queries', () => {
  it('orders versions newest first by semver precedence', async () => {
    const versions = await versionsOf(fixtureLedger)({ pkg: 'lit-ui-router' });

    assert.deepEqual(
      versions.map(({ version }) => version),
      ['1.11.0-rc.0', '1.10.0', '1.9.0', '1.2.0'],
    );
    await assert.rejects(
      versionsOf(fixtureLedger)({ pkg: 'not-a-package' }),
      NotInLedger,
    );
  });

  it('rejects a version the ledger has no row for', async () => {
    const versions = await versionsOf(fixtureLedger)({ pkg: 'lit-ui-router' });

    assert.equal(
      versionIn(versions, { pkg: 'lit-ui-router', version: '1.10.0' }).version,
      '1.10.0',
    );
    assert.throws(
      () => versionIn(versions, { pkg: 'lit-ui-router', version: '9.9.9' }),
      NotInLedger,
    );
  });

  it("reads latest from npm's dist-tag", async () => {
    assert.equal(
      await latestVersionOf(fixtureLedger)({ pkg: 'lit-ui-router' }),
      '1.10.0',
    );
    await assert.rejects(
      latestVersionOf(fixtureLedger)({ pkg: 'ui-router-signals' }),
      NotInLedger,
    );
  });
});

describe('the /gh verdicts', () => {
  const cases = [
    ['/gh', 302, '/gh/releases/'],
    ['/gh/', 302, '/gh/releases/'],
    ['/gh/releases', 308, '/gh/releases/'],
    ['/gh/releases/', 200, null],
    ['/gh/releases/lit-ui-router', 308, '/gh/releases/lit-ui-router/'],
    ['/gh/releases/lit-ui-router/', 200, null],
    ['/gh/releases/ui-router-server/', 200, null],
    ['/gh/releases/lit-ui-router/1.10.0/', 200, null],
    [
      '/gh/releases/lit-ui-router/latest',
      302,
      '/gh/releases/lit-ui-router/1.10.0/',
    ],
    [
      '/gh/releases/lit-ui-router/latest/',
      302,
      '/gh/releases/lit-ui-router/1.10.0/',
    ],
    ['/gh/releases/lit-ui-router/9.9.9/', 404, null],
    ['/gh/releases/ui-router-signals/latest', 404, null],
    ['/gh/releases/ui-router-signals/', 404, null],
    ['/gh/releases/not-a-package/', 404, null],
    ['/gh/elsewhere', 404, null],
  ] as const;

  for (const [path, status, location] of cases) {
    it(`answers ${path} with ${status}`, async () => {
      const response = await serve(path);

      assert.equal(response?.status, status);
      assert.equal(response?.headers.get('Location'), location);
    });
  }

  it('keeps the request search on a redirect', async () => {
    const response = await serve('/gh/releases/lit-ui-router/latest?ref=badge');

    assert.equal(
      response?.headers.get('Location'),
      '/gh/releases/lit-ui-router/1.10.0/?ref=badge',
    );
  });

  it('passes paths outside the mount to the host', async () => {
    assert.equal(await serve('/app/welcome'), null);
    assert.equal(await serve('/ghost'), null);
  });

  it('answers only GET and HEAD', async () => {
    const response = await serve('/gh/releases/', { method: 'POST' });

    assert.equal(response?.status, 405);
    assert.equal(response?.headers.get('Allow'), 'GET, HEAD');
  });

  it('answers HEAD with headers and no body', async () => {
    const response = await serve('/gh/releases/', { method: 'HEAD' });

    assert.equal(response?.status, 200);
    assert.equal(response?.body, null);
  });

  it('answers 503 while the ledger cannot be read', async () => {
    const response = await serve('/gh/releases/lit-ui-router/', {}, DOWN);

    assert.equal(response?.status, 503);
    assert.equal(response?.headers.get('Cache-Control'), 'no-store');
    assert.match((await response?.text()) ?? '', /Releases are unavailable/);
  });
});

describe('the /gh pages', () => {
  const page = async (path: string) => (await serve(path))?.text() ?? '';

  it('lists every package with its latest release', async () => {
    const html = await page('/gh/releases/');

    for (const { name } of await fixtureLedger.packages())
      assert.ok(html.includes(`href="/gh/releases/${name}/"`), name);
    assert.ok(html.includes('href="/gh/releases/lit-ui-router/1.10.0/"'));
    assert.match(html, /<title>Releases \| Lit UI Router<\/title>/);
  });

  it("lists a package's versions, each linking to its GitHub release", async () => {
    const html = await page('/gh/releases/lit-ui-router/');

    const order = ['1.11.0-rc.0', '1.10.0', '1.9.0', '1.2.0'].map((version) =>
      html.indexOf(`href="/gh/releases/lit-ui-router/${version}/"`),
    );

    assert.ok(
      order.every((at, i) => at > 0 && (i === 0 || at > (order[i - 1] ?? 0))),
    );
    assert.ok(
      html.includes(
        'href="https://github.com/simshanith/lit-ui-router/releases/tag/lit-ui-router%401.10.0"',
      ),
    );
    assert.match(html, /prerelease/);
  });

  it("shows one version's facts and links out", async () => {
    const html = await page('/gh/releases/lit-ui-router/1.9.0/');

    assert.match(html, /<h1>.*lit-ui-router.*@.*1\.9\.0.*<\/h1>/);
    assert.match(html, /Deprecated/);
    assert.match(html, /use 2\.0/);
    assert.ok(
      html.includes(
        'href="https://github.com/simshanith/lit-ui-router/tree/lit-ui-router%401.9.0"',
      ),
    );
  });

  it('renders the 404 page for a version the ledger lacks', async () => {
    const response = await serve('/gh/releases/lit-ui-router/9.9.9/');

    assert.match((await response?.text()) ?? '', /<h1>Not found<\/h1>/);
  });

  it('links the stylesheet the docs site serves', async () => {
    const html = await page('/gh/releases/');

    assert.ok(html.includes(`<link rel="stylesheet" href="${STYLESHEET}">`));
    assert.ok(
      existsSync(join(import.meta.dirname, '../../public', STYLESHEET)),
    );
  });

  it('escapes the head and keeps the body as rendered', async () => {
    const body = '<ui-view defer-hydration><p>a &amp; b</p></ui-view>';

    const html = await releaseDocument(body, {
      title: 'a <b> & "c"',
      description: 'd <e> & "f"',
    });

    assert.match(
      html,
      /<title>a &lt;b&gt; &amp; &quot;c&quot; \| Lit UI Router<\/title>/,
    );
    assert.ok(
      html.includes(
        '<meta name="description" content="d &lt;e&gt; &amp; &quot;f&quot;">',
      ),
    );
    assert.ok(
      html.includes(`<main class="content-grid"><div>${body}</div></main>`),
    );
    assert.ok(html.startsWith('<!doctype html>\n<html lang="en">'));
  });

  it('ships no client script', async () => {
    const html = await page('/gh/releases/lit-ui-router/');

    assert.deepEqual(
      html.match(/<script(?![^>]*type="application\/json")/g),
      null,
    );
  });
});
