import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import '../dom-shim.ts';
import { releaseDocument, STYLESHEET } from '../releases/document.ts';
import {
  type LedgerReader,
  latestOf,
  NotInLedger,
  versionIn,
  versionsOf,
} from '../releases/ledger.ts';
import { FRESH_MS, KEEP_MS, STORED_AT } from '../releases/edge-cache.ts';
import { serveReleases } from '../releases/serve.ts';
import { fixtureLedger } from './ledger-stub/rows.ts';
import { memoryEdge } from './memory-cache.ts';

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
      (await latestOf(fixtureLedger)({ pkg: 'lit-ui-router' })).version,
      '1.10.0',
    );
    await assert.rejects(
      latestOf(fixtureLedger)({ pkg: 'ui-router-signals' }),
      NotInLedger,
    );
  });
});

const GITHUB = 'https://github.com/simshanith/lit-ui-router/releases/tag';

describe('the /releases verdicts', () => {
  const cases = [
    ['/releases', 308, '/releases/'],
    ['/releases/', 200, null],
    ['/releases/lit-ui-router', 308, '/releases/lit-ui-router/'],
    ['/releases/lit-ui-router/', 200, null],
    ['/releases/ui-router-server/', 200, null],
    ['/releases/lit-ui-router/1.10.0', 308, '/releases/lit-ui-router/1.10.0/'],
    ['/releases/lit-ui-router/1.10.0/', 200, null],
    ['/releases/lit-ui-router/latest', 302, '/releases/lit-ui-router/1.10.0/'],
    ['/releases/lit-ui-router/latest/', 302, '/releases/lit-ui-router/1.10.0/'],
    ['/releases/lit-ui-router/9.9.9/', 404, null],
    ['/releases/ui-router-signals/latest', 404, null],
    ['/releases/ui-router-signals/', 404, null],
    ['/releases/not-a-package/', 404, null],
    ['/releases/lit-ui-router/1.10.0/elsewhere', 404, null],
  ] as const;

  for (const [path, status, location] of cases) {
    it(`answers ${path} with ${status}`, async () => {
      const response = await serve(path);

      assert.equal(response?.status, status);
      assert.equal(response?.headers.get('Location'), location);
    });
  }

  it('keeps the request search on a redirect', async () => {
    const response = await serve('/releases/lit-ui-router/latest?ref=badge');

    assert.equal(
      response?.headers.get('Location'),
      '/releases/lit-ui-router/1.10.0/?ref=badge',
    );
    assert.equal(response?.headers.get('Cache-Control'), 'public, max-age=300');
  });

  it('passes paths outside the mounts to the host', async () => {
    assert.equal(await serve('/app/welcome'), null);
    assert.equal(await serve('/ghost'), null);
    assert.equal(await serve('/releasesx/'), null);
  });

  it('answers only GET and HEAD', async () => {
    const response = await serve('/releases/', { method: 'POST' });

    assert.equal(response?.status, 405);
    assert.equal(response?.headers.get('Allow'), 'GET, HEAD');
  });

  it('answers HEAD with headers and no body', async () => {
    const response = await serve('/releases/', { method: 'HEAD' });

    assert.equal(response?.status, 200);
    assert.equal(response?.body, null);
  });

  it('answers 503 while the ledger cannot be read', async () => {
    const response = await serve('/releases/lit-ui-router/', {}, DOWN);

    assert.equal(response?.status, 503);
    assert.equal(response?.headers.get('Cache-Control'), 'no-store');
    assert.match((await response?.text()) ?? '', /Releases are unavailable/);
  });
});

describe('the /gh verdicts', () => {
  const cases = [
    [
      '/gh/releases/lit-ui-router/latest',
      302,
      `${GITHUB}/lit-ui-router%401.10.0`,
    ],
    [
      '/gh/releases/lit-ui-router/latest/',
      302,
      `${GITHUB}/lit-ui-router%401.10.0`,
    ],
    [
      '/gh/releases/ui-router-server/latest',
      302,
      `${GITHUB}/ui-router-server%400.3.0`,
    ],
    ['/gh/releases/ui-router-signals/latest', 404, null],
    ['/gh/releases/not-a-package/latest', 404, null],
    ['/gh', 404, null],
    ['/gh/', 404, null],
    ['/gh/releases', 404, null],
    ['/gh/releases/', 404, null],
    ['/gh/releases/lit-ui-router', 404, null],
    ['/gh/releases/lit-ui-router/', 404, null],
    ['/gh/releases/lit-ui-router/1.10.0/', 404, null],
    ['/gh/elsewhere', 404, null],
  ] as const;

  for (const [path, status, location] of cases) {
    it(`answers ${path} with ${status}`, async () => {
      const response = await serve(path);

      assert.equal(response?.status, status);
      assert.equal(response?.headers.get('Location'), location);
    });
  }

  it('drops the request search on the way to GitHub', async () => {
    const response = await serve('/gh/releases/lit-ui-router/latest?ref=badge');

    assert.equal(
      response?.headers.get('Location'),
      `${GITHUB}/lit-ui-router%401.10.0`,
    );
    assert.equal(response?.headers.get('Cache-Control'), 'public, max-age=60');
  });

  it('falls back to the version page, search kept, when the ledger records no GitHub release', async () => {
    const ledger: LedgerReader = {
      ...fixtureLedger,
      tagged: async (name, tag) => {
        const row = await fixtureLedger.tagged(name, tag);

        return row && { ...row, gh_url: null };
      },
    };

    const response = await serve(
      '/gh/releases/lit-ui-router/latest?ref=badge',
      {},
      ledger,
    );

    assert.equal(response?.status, 302);
    assert.equal(
      response?.headers.get('Location'),
      '/releases/lit-ui-router/1.10.0/?ref=badge',
    );
  });

  it('reads the ledger once', async () => {
    const reads: string[] = [];

    const ledger: LedgerReader = {
      packages: () => {
        reads.push('packages');

        return fixtureLedger.packages();
      },
      tagged: (name, tag) => {
        reads.push('tagged');

        return fixtureLedger.tagged(name, tag);
      },
      versions: (name) => {
        reads.push('versions');

        return fixtureLedger.versions(name);
      },
    };

    await serve('/gh/releases/lit-ui-router/latest', {}, ledger);

    assert.deepEqual(reads, ['tagged']);
  });

  it('answers HEAD with the redirect and no body', async () => {
    const response = await serve('/gh/releases/lit-ui-router/latest', {
      method: 'HEAD',
    });

    assert.equal(response?.status, 302);
    assert.equal(
      response?.headers.get('Location'),
      `${GITHUB}/lit-ui-router%401.10.0`,
    );
    assert.equal(response?.body, null);
  });

  it('renders the 404 page for a path GitHub already answers', async () => {
    const response = await serve('/gh/releases/');

    assert.match((await response?.text()) ?? '', /<h1>Not found<\/h1>/);
    assert.equal(response?.headers.get('Cache-Control'), 'public, max-age=300');
  });

  it('answers 503 while the ledger cannot be read', async () => {
    const response = await serve('/gh/releases/lit-ui-router/latest', {}, DOWN);

    assert.equal(response?.status, 503);
    assert.equal(response?.headers.get('Cache-Control'), 'no-store');
    assert.equal(response?.headers.get('Location'), null);
  });
});

describe('the /gh edge cache', () => {
  const LATEST = '/gh/releases/lit-ui-router/latest';

  const counting = (base: LedgerReader = fixtureLedger) => {
    let reads = 0;

    const ledger: LedgerReader = {
      packages: () => {
        reads += 1;

        return base.packages();
      },
      tagged: (name, tag) => {
        reads += 1;

        return base.tagged(name, tag);
      },
      versions: (name) => {
        reads += 1;

        return base.versions(name);
      },
    };

    return { ledger, reads: () => reads };
  };

  /** The fixture ledger with npm's `latest` moved to `version`. */
  const latestAt = (version: string): LedgerReader => ({
    ...fixtureLedger,
    tagged: async (name) =>
      (await fixtureLedger.versions(name)).find(
        (row) => row.version === version,
      ) ?? null,
  });

  const KEY = `${ORIGIN}${LATEST}`;

  const storedAt = (memory: ReturnType<typeof memoryEdge>) =>
    memory.entries.get(KEY)?.headers.get(STORED_AT);

  const serveVia = (
    memory: ReturnType<typeof memoryEdge>,
    path: string,
    ledger: LedgerReader,
    init?: RequestInit,
  ) =>
    serveReleases(new Request(`${ORIGIN}${path}`, init), ledger, memory.edge);

  it('writes a miss to the cache for a day, while the client keeps it 60 s', async () => {
    const memory = memoryEdge();
    const response = await serveVia(memory, LATEST, fixtureLedger);
    await memory.settled();

    assert.equal(response?.status, 302);
    assert.equal(response?.headers.get('Cache-Control'), 'public, max-age=60');
    assert.deepEqual(memory.calls, [`match GET ${KEY}`, `put GET ${KEY}`]);
    assert.equal(
      memory.entries.get(KEY)?.headers.get('Cache-Control'),
      'public, max-age=86400',
    );
    assert.equal(storedAt(memory), String(memory.edge.now()));
  });

  it('answers a fresh hit without reading the ledger, at the client max-age', async () => {
    const memory = memoryEdge();
    await serveVia(memory, LATEST, fixtureLedger);
    await memory.settled();
    memory.advance(FRESH_MS - 1);

    const { ledger, reads } = counting();
    const response = await serveVia(memory, LATEST, ledger);

    assert.equal(reads(), 0);
    assert.equal(memory.background(), 1);
    assert.equal(response?.status, 302);
    assert.equal(
      response?.headers.get('Location'),
      `${GITHUB}/lit-ui-router%401.10.0`,
    );
    assert.equal(response?.headers.get('Cache-Control'), 'public, max-age=60');
    assert.equal(response?.headers.get('X-Edge-Client-Cache-Control'), null);
  });

  it('answers a stale hit at once and refreshes it once behind the response', async () => {
    const memory = memoryEdge();
    await serveVia(memory, LATEST, fixtureLedger);
    await memory.settled();
    memory.advance(FRESH_MS);

    const { ledger, reads } = counting(latestAt('1.2.0'));
    const response = await serveVia(memory, LATEST, ledger);

    assert.equal(
      response?.headers.get('Location'),
      `${GITHUB}/lit-ui-router%401.10.0`,
    );
    assert.equal(memory.background(), 2);

    await memory.settled();

    assert.equal(reads(), 1);
    assert.equal(storedAt(memory), String(memory.edge.now()));

    const next = await serveVia(memory, LATEST, ledger);

    assert.equal(
      next?.headers.get('Location'),
      `${GITHUB}/lit-ui-router%401.2.0`,
    );
    assert.equal(reads(), 1);
  });

  it('looks an entry past the day up before answering', async () => {
    const memory = memoryEdge();
    await serveVia(memory, LATEST, fixtureLedger);
    await memory.settled();
    memory.advance(KEEP_MS);

    const { ledger, reads } = counting(latestAt('1.2.0'));
    const response = await serveVia(memory, LATEST, ledger);

    assert.equal(reads(), 1);
    assert.equal(
      response?.headers.get('Location'),
      `${GITHUB}/lit-ui-router%401.2.0`,
    );
  });

  it('keeps the stale entry when its refresh fails', async () => {
    const memory = memoryEdge();
    await serveVia(memory, LATEST, fixtureLedger);
    await memory.settled();
    const before = storedAt(memory);
    memory.advance(FRESH_MS);

    const response = await serveVia(memory, LATEST, DOWN);
    await memory.settled();

    assert.equal(response?.status, 302);
    assert.equal(storedAt(memory), before);
    assert.deepEqual(memory.calls, [
      `match GET ${KEY}`,
      `put GET ${KEY}`,
      `match GET ${KEY}`,
    ]);
  });

  it('shares one entry across a trailing slash, a fragment and HEAD', async () => {
    const memory = memoryEdge();
    await serveVia(memory, `${LATEST}/`, fixtureLedger);
    await memory.settled();

    const { ledger, reads } = counting();

    const response = await serveVia(memory, `${LATEST}#top`, ledger, {
      method: 'HEAD',
    });

    assert.equal(reads(), 0);
    assert.equal(response?.status, 302);
    assert.equal(response?.body, null);
    assert.deepEqual([...memory.entries.keys()], [`${ORIGIN}${LATEST}`]);
  });

  it('keys on the search, which the fallback location keeps', async () => {
    const memory = memoryEdge();
    await serveVia(memory, LATEST, fixtureLedger);
    await serveVia(memory, `${LATEST}?ref=badge`, fixtureLedger);
    await memory.settled();

    assert.deepEqual(
      [...memory.entries.keys()],
      [`${ORIGIN}${LATEST}`, `${ORIGIN}${LATEST}?ref=badge`],
    );
  });

  it('keeps no 404 and no 503', async () => {
    const memory = memoryEdge();

    const missing = await serveVia(
      memory,
      '/gh/releases/ui-router-signals/latest',
      fixtureLedger,
    );

    const down = await serveVia(memory, LATEST, DOWN);
    await memory.settled();

    assert.equal(missing?.status, 404);
    assert.equal(down?.status, 503);
    assert.equal(memory.entries.size, 0);
  });

  it('leaves the /releases pages and redirects uncached', async () => {
    const memory = memoryEdge();
    await serveVia(memory, '/releases/lit-ui-router/', fixtureLedger);
    await serveVia(memory, '/releases/lit-ui-router/latest', fixtureLedger);
    await memory.settled();

    assert.deepEqual(memory.calls, []);
  });
});

describe('the /releases pages', () => {
  const page = async (path: string) => (await serve(path))?.text() ?? '';

  it('lists every package with its latest release', async () => {
    const html = await page('/releases/');

    for (const { name } of await fixtureLedger.packages())
      assert.ok(html.includes(`href="/releases/${name}/"`), name);
    assert.ok(html.includes('href="/releases/lit-ui-router/1.10.0/"'));
    assert.match(html, /<title>Releases \| Lit UI Router<\/title>/);
  });

  it("lists a package's versions, each linking to its GitHub release", async () => {
    const html = await page('/releases/lit-ui-router/');

    const order = ['1.11.0-rc.0', '1.10.0', '1.9.0', '1.2.0'].map((version) =>
      html.indexOf(`href="/releases/lit-ui-router/${version}/"`),
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
    const html = await page('/releases/lit-ui-router/1.9.0/');

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
    const response = await serve('/releases/lit-ui-router/9.9.9/');

    assert.match((await response?.text()) ?? '', /<h1>Not found<\/h1>/);
  });

  it('links the stylesheet the docs build emits', async () => {
    const html = await page('/releases/');

    assert.ok(html.includes(`<link rel="stylesheet" href="${STYLESHEET}">`));
    assert.ok(existsSync(join(import.meta.dirname, '../releases', STYLESHEET)));
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

  it('ships only the appearance check as client script', async () => {
    const html = await page('/releases/lit-ui-router/');

    assert.deepEqual(
      html.match(/<script(?![^>]*type="application\/json")[^>]*>/g),
      ['<script id="check-dark-mode">'],
    );
  });
});
