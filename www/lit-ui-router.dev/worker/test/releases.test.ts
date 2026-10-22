import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  getAllByRole,
  getByRole,
  getByText,
  queryByRole,
  queryByText,
  within,
} from '@testing-library/dom';
import { parseHtml } from '@tools/lit-test-env/parse-html.ts';

import '../dom-shim.ts';
import type { ReleaseDiffs } from '../releases/diff-data.ts';
import {
  DIFF_SCRIPT,
  releaseDocument,
  STYLESHEET,
} from '../releases/document.ts';
import {
  type LedgerReader,
  latestOf,
  NotInLedger,
  previousIn,
  versionIn,
  versionsOf,
} from '../releases/ledger.ts';
import { FRESH_MS, KEEP_MS, STORED_AT } from '../releases/edge-cache.ts';
import { serveReleases } from '../releases/serve.ts';
import { diffUrl } from '../releases/views.ts';
import { FIXTURE_ROWS, fixtureLedger } from './ledger-stub/rows.ts';
import { memoryEdge } from './memory-cache.ts';

const ORIGIN = 'http://docs.test';

// The pages never read a diff; the data routes have their own suite.
const unread = (pair: { name: string; from: string; to: string }) =>
  Promise.reject(new Error(`read ${pair.name}@${pair.from}...${pair.to}`));

const NO_DIFFS: ReleaseDiffs = {
  index: unread,
  files: unread,
  patch: unread,
};

const serve = (path: string, init?: RequestInit, ledger = fixtureLedger) =>
  serveReleases(new Request(`${ORIGIN}${path}`, init), ledger, NO_DIFFS);

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

describe('the diff links', () => {
  const [base] = FIXTURE_ROWS;
  assert.ok(base);

  const at = (version: string) => ({ ...base, version });

  // Newest first, as versionsOf orders them.
  const versions = ['2.0.0', '2.0.0-rc.1', '2.0.0-rc.0', '1.10.0'].map(at);

  const previous = (version: string) =>
    previousIn(versions, at(version))?.version ?? null;

  it('compares a stable version with the previous stable one', () => {
    assert.equal(previous('2.0.0'), '1.10.0');
  });

  it('compares a prerelease with the version just before it', () => {
    assert.equal(previous('2.0.0-rc.1'), '2.0.0-rc.0');
    assert.equal(previous('2.0.0-rc.0'), '1.10.0');
  });

  it('has nothing to compare the first version, or an unlisted one, with', () => {
    assert.equal(previous('1.10.0'), null);
    assert.equal(previous('9.9.9'), null);
  });

  it("links DiffsHub's compare between two tags", () => {
    assert.equal(
      diffUrl(at('1.9.0'), at('1.10.0')),
      'https://diffshub.com/simshanith/lit-ui-router/compare/lit-ui-router%401.9.0...lit-ui-router%401.10.0',
    );
  });

  it('links nothing when either version has no tag recorded', () => {
    assert.equal(
      diffUrl({ ...at('1.9.0'), git_sha: null }, at('1.10.0')),
      null,
    );
    assert.equal(
      diffUrl(at('1.9.0'), { ...at('1.10.0'), git_sha: null }),
      null,
    );
  });
});

const GITHUB = 'https://github.com/simshanith/lit-ui-router/releases/tag';

const DIFFS = 'https://diffshub.com/simshanith/lit-ui-router/compare';

const FILES = '/releases/lit-ui-router/diff';

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
    getByRole(parseHtml((await response?.text()) ?? '').body, 'heading', {
      level: 1,
      name: 'Releases are unavailable',
    });
  });
});

describe('the /releases/<pkg>/diff redirects', () => {
  const diff = '/releases/lit-ui-router/diff';

  const cases = [
    [
      `${diff}?from=1.9.0&to=1.10.0`,
      302,
      `${DIFFS}/lit-ui-router%401.9.0...lit-ui-router%401.10.0`,
    ],
    [
      `${diff}/?from=1.9.0&to=1.10.0&via=diffshub`,
      302,
      `${DIFFS}/lit-ui-router%401.9.0...lit-ui-router%401.10.0`,
    ],
    [
      `${diff}?from=1.10.0&to=1.11.0-rc.0&via=files`,
      302,
      `${FILES}/1.10.0...1.11.0-rc.0/`,
    ],
    [
      `${diff}/?from=1.10.0&to=1.9.0&via=files`,
      302,
      `${FILES}/1.10.0...1.9.0/`,
    ],
    [`${diff}?from=1.9.0&to=9.9.9`, 404, null],
    [`${diff}?from=9.9.9&to=1.10.0&via=files`, 404, null],
    [`${diff}?from=1.9.0`, 404, null],
    [diff, 404, null],
    [`${diff}?from=1.9.0&to=1.10.0&via=github`, 404, null],
    [`${diff}?from=1.9.0&from=1.2.0&to=1.10.0`, 404, null],
    ['/releases/not-a-package/diff?from=1.9.0&to=1.10.0', 404, null],
  ] as const;

  for (const [path, status, location] of cases) {
    it(`answers ${path} with ${status}`, async () => {
      const response = await serve(path);

      assert.equal(response?.status, status);
      assert.equal(response?.headers.get('Location'), location);
    });
  }

  it('drops the request search and caches like the pages', async () => {
    const response = await serve(`${diff}?from=1.9.0&to=1.10.0&ref=form`);

    assert.equal(
      response?.headers.get('Location'),
      `${DIFFS}/lit-ui-router%401.9.0...lit-ui-router%401.10.0`,
    );
    assert.equal(response?.headers.get('Cache-Control'), 'public, max-age=300');
  });

  const without = (field: 'git_sha' | 'npm_integrity'): LedgerReader => ({
    ...fixtureLedger,
    versions: async (name) =>
      (await fixtureLedger.versions(name)).map((row) =>
        row.version === '1.9.0' ? { ...row, [field]: null } : row,
      ),
  });

  it('answers 404 for a DiffsHub compare whose tag the ledger lacks', async () => {
    const ledger = without('git_sha');

    assert.equal(
      (await serve(`${diff}?from=1.9.0&to=1.10.0`, {}, ledger))?.status,
      404,
    );
    assert.equal(
      (await serve(`${diff}?from=1.9.0&to=1.10.0&via=files`, {}, ledger))
        ?.status,
      302,
    );
  });

  it('answers 404 for a published-files diff of a version npm lacks', async () => {
    const response = await serve(
      `${diff}?from=1.9.0&to=1.10.0&via=files`,
      {},
      without('npm_integrity'),
    );

    assert.equal(response?.status, 404);
  });

  it('reads the versions once', async () => {
    const reads: string[] = [];

    const ledger: LedgerReader = {
      ...fixtureLedger,
      tagged: (name, tag) => {
        reads.push('tagged');

        return fixtureLedger.tagged(name, tag);
      },
      versions: (name) => {
        reads.push('versions');

        return fixtureLedger.versions(name);
      },
    };

    await serve(`${diff}?from=1.9.0&to=1.10.0`, {}, ledger);

    assert.deepEqual(reads, ['versions']);
  });

  it('answers HEAD with the redirect and no body', async () => {
    const response = await serve(`${diff}?from=1.9.0&to=1.10.0`, {
      method: 'HEAD',
    });

    assert.equal(response?.status, 302);
    assert.equal(response?.body, null);
  });
});

describe('the /releases/<pkg>/diff/<from>...<to> pages', () => {
  const cases = [
    [`${FILES}/1.9.0...1.10.0/`, 200, null],
    [`${FILES}/1.9.0...1.10.0/?files=js`, 200, null],
    [`${FILES}/1.10.0...1.11.0-rc.0/`, 200, null],
    [`${FILES}/1.10.0...1.2.0/`, 200, null],
    [`${FILES}/1.9.0...1.10.0`, 308, `${FILES}/1.9.0...1.10.0/`],
    [`${FILES}/1.9.0...1.10.0?ref=x`, 308, `${FILES}/1.9.0...1.10.0/?ref=x`],
    [`${FILES}/1.9.0...9.9.9/`, 404, null],
    [`${FILES}/9.9.9...1.10.0/`, 404, null],
    [`${FILES}/1.9.0..1.10.0/`, 404, null],
    [`${FILES}/1.9.0.../`, 404, null],
    ['/releases/not-a-package/diff/1.9.0...1.10.0/', 404, null],
  ] as const;

  for (const [path, status, location] of cases) {
    it(`answers ${path} with ${status}`, async () => {
      const response = await serve(path);

      assert.equal(response?.status, status);
      assert.equal(response?.headers.get('Location'), location);
    });
  }

  it('renders a shell the diff script fills in', async () => {
    const response = await serve(`${FILES}/1.9.0...1.10.0/`);
    const doc = parseHtml((await response?.text()) ?? '');

    assert.equal(
      response?.headers.get('Content-Type'),
      'text/html; charset=utf-8',
    );
    assert.equal(response?.headers.get('Cache-Control'), 'public, max-age=300');
    assert.equal(doc.title, 'lit-ui-router 1.9.0...1.10.0 | Lit UI Router');

    const shell = getByRole(doc.body, 'region', { name: 'Changed files' });

    // The script finds its host and controls by class and data attributes, which carry no role.
    assert.ok(shell.classList.contains('npm-diff'));
    assert.ok(shell.hasAttribute('data-npm-diff'));
    assert.deepEqual(
      ['data-package', 'data-from', 'data-to'].map((name) =>
        shell.getAttribute(name),
      ),
      ['lit-ui-router', '1.9.0', '1.10.0'],
    );
    assert.deepEqual(
      getAllByRole(shell, 'status').map((status) => status.textContent),
      ['Loading the diff…', ''],
    );

    // Both start hidden, and a hidden element computes no accessible name.
    assert.equal(queryByRole(shell, 'group'), null);
    assert.equal(queryByRole(shell, 'navigation'), null);

    const filter = getByRole(shell, 'group', { hidden: true });
    assert.ok(filter.hidden);
    assert.ok(filter.classList.contains('diff-filter'));
    getByText(filter, 'Show', { selector: 'legend' });

    const nav = getByRole(shell, 'navigation', { hidden: true });
    assert.ok(nav.hidden);
    assert.ok(nav.classList.contains('diff-nav'));
    assert.equal(nav.getAttribute('aria-label'), 'Files');

    assert.equal(
      getByRole(doc.body, 'link', { name: 'on DiffsHub' }).getAttribute('href'),
      `${DIFFS}/lit-ui-router%401.9.0...lit-ui-router%401.10.0`,
    );
    assert.equal(
      within(getByRole(doc.body, 'navigation', { name: 'Breadcrumb' }))
        .getByRole('link', { name: 'lit-ui-router' })
        .getAttribute('href'),
      '/releases/lit-ui-router/',
    );
  });

  it('links no DiffsHub compare without both tags', async () => {
    const ledger: LedgerReader = {
      ...fixtureLedger,
      versions: async (name) =>
        (await fixtureLedger.versions(name)).map((row) =>
          row.version === '1.9.0' ? { ...row, git_sha: null } : row,
        ),
    };

    const response = await serve(`${FILES}/1.9.0...1.10.0/`, {}, ledger);

    assert.equal(response?.status, 200);
    assert.deepEqual(
      getAllByRole(parseHtml((await response?.text()) ?? '').body, 'link')
        .map((link) => link.getAttribute('href'))
        .filter((href) => href?.startsWith('https://diffshub.com/')),
      [],
    );
  });

  it('answers 404 for a version npm lacks', async () => {
    const ledger: LedgerReader = {
      ...fixtureLedger,
      versions: async (name) =>
        (await fixtureLedger.versions(name)).map((row) =>
          row.version === '1.9.0' ? { ...row, npm_integrity: null } : row,
        ),
    };

    const response = await serve(`${FILES}/1.9.0...1.10.0/`, {}, ledger);

    assert.equal(response?.status, 404);
    getByRole(parseHtml((await response?.text()) ?? '').body, 'heading', {
      level: 1,
      name: 'Not found',
    });
  });

  it('answers HEAD with headers and no body', async () => {
    const response = await serve(`${FILES}/1.9.0...1.10.0/`, {
      method: 'HEAD',
    });

    assert.equal(response?.status, 200);
    assert.equal(response?.body, null);
    assert.equal(
      (await serve(`${FILES}/1.9.0...9.9.9/`, { method: 'HEAD' }))?.status,
      404,
    );
  });

  it('answers 503 while the ledger cannot be read', async () => {
    const response = await serve(`${FILES}/1.9.0...1.10.0/`, {}, DOWN);

    assert.equal(response?.status, 503);
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

    getByRole(parseHtml((await response?.text()) ?? '').body, 'heading', {
      level: 1,
      name: 'Not found',
    });
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
    serveReleases(
      new Request(`${ORIGIN}${path}`, init),
      ledger,
      NO_DIFFS,
      memory.edge,
    );

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
  const page = async (path: string) =>
    parseHtml((await (await serve(path))?.text()) ?? '');

  const hrefOf = (container: HTMLElement, name: string) =>
    getByRole(container, 'link', { name }).getAttribute('href');

  it('lists every package with its latest release', async () => {
    const doc = await page('/releases/');

    for (const { name } of await fixtureLedger.packages())
      assert.equal(hrefOf(doc.body, name), `/releases/${name}/`);
    assert.equal(
      hrefOf(doc.body, 'lit-ui-router@1.10.0'),
      '/releases/lit-ui-router/1.10.0/',
    );
    assert.equal(doc.title, 'Releases | Lit UI Router');
  });

  it("lists a package's versions, each linking to its GitHub release", async () => {
    const doc = await page('/releases/lit-ui-router/');

    assert.deepEqual(
      getAllByRole(getByRole(doc.body, 'table'), 'rowheader').map((header) =>
        within(header).getByRole('link').getAttribute('href'),
      ),
      ['1.11.0-rc.0', '1.10.0', '1.9.0', '1.2.0'].map(
        (version) => `/releases/lit-ui-router/${version}/`,
      ),
    );
    assert.equal(
      hrefOf(doc.body, 'GitHub release for lit-ui-router@1.10.0'),
      'https://github.com/simshanith/lit-ui-router/releases/tag/lit-ui-router%401.10.0',
    );
    getByRole(doc.body, 'rowheader', { name: '1.11.0-rc.0 prerelease' });
    assert.equal(
      hrefOf(doc.body, 'Diff from 1.9.0 to 1.10.0'),
      `${DIFFS}/lit-ui-router%401.9.0...lit-ui-router%401.10.0`,
    );
    assert.equal(
      hrefOf(doc.body, 'Diff from 1.10.0 to 1.11.0-rc.0'),
      `${DIFFS}/lit-ui-router%401.10.0...lit-ui-router%401.11.0-rc.0`,
    );
    assert.equal(
      getAllByRole(doc.body, 'link', { name: /^Diff from / }).length,
      3,
    );
  });

  it('picks a diff with a form that needs no script', async () => {
    const doc = await page('/releases/lit-ui-router/');
    const form = getByRole(doc.body, 'form', { name: 'Compare two versions' });

    assert.equal(form.getAttribute('method'), 'get');
    assert.equal(form.getAttribute('action'), '/releases/lit-ui-router/diff');
    assert.deepEqual(
      getAllByRole(form, 'combobox').map((select) =>
        select.getAttribute('name'),
      ),
      ['from', 'to'],
    );

    // happy-dom's parsed selectedness leaks across selects, so read the served `selected` attribute.
    const picked = (name: string) =>
      within(getByRole(form, 'combobox', { name }))
        .getAllByRole('option')
        .filter((option) => option.hasAttribute('selected'))
        .map((option) => option.getAttribute('value'));

    assert.deepEqual(picked('From'), ['1.9.0']);
    assert.deepEqual(picked('To'), ['1.10.0']);

    for (const name of ['From', 'To'])
      assert.equal(
        within(getByRole(form, 'combobox', { name })).getAllByRole('option')
          .length,
        4,
      );
    getByRole(form, 'button', { name: 'Compare (opens in a new tab)' });
    assert.equal(form.getAttribute('target'), '_blank');
    assert.equal(form.getAttribute('rel'), 'noopener');

    const via = getByRole(form, 'group', { name: 'Diff' });

    assert.deepEqual(
      getAllByRole(via, 'radio').map((radio) => [
        radio.getAttribute('name'),
        radio.getAttribute('value'),
      ]),
      [
        ['via', 'diffshub'],
        ['via', 'files'],
      ],
    );
    getByRole(via, 'radio', { name: 'Git source on DiffsHub', checked: true });
    getByRole(via, 'radio', { name: 'Published files', checked: false });
  });

  it('offers no diff form for a package with one version', async () => {
    const doc = await page('/releases/ui-router-server/');

    assert.equal(queryByRole(doc.body, 'form'), null);
  });

  it("shows one version's facts and links out", async () => {
    const doc = await page('/releases/lit-ui-router/1.9.0/');

    getByRole(doc.body, 'heading', { level: 1, name: 'lit-ui-router@1.9.0' });
    // A term takes no accessible name from its content, so its text finds it.
    assert.equal(
      getByText(doc.body, 'Deprecated', { selector: 'dt' }).nextElementSibling
        ?.textContent,
      'use 2.0',
    );
    assert.equal(
      hrefOf(doc.body, 'lit-ui-router@1.9.0'),
      'https://github.com/simshanith/lit-ui-router/tree/lit-ui-router%401.9.0',
    );
    // A definition takes no accessible name from its content, so its text finds it.
    const diff = getByText(doc.body, 'on DiffsHub', { selector: 'dd' });
    assert.equal(
      hrefOf(diff, 'Diff from 1.2.0 to 1.9.0'),
      `${DIFFS}/lit-ui-router%401.2.0...lit-ui-router%401.9.0`,
    );

    // A definition takes no accessible name from its content, so its term finds it.
    const files = getByText(doc.body, 'Published files', {
      selector: 'dt',
    }).nextElementSibling;

    assert.ok(files);
    assert.equal(
      // SAFETY: a dt's sibling in a parsed page is an HTML element.
      hrefOf(files as HTMLElement, 'Diff from 1.2.0 to 1.9.0'),
      `${FILES}/1.2.0...1.9.0/`,
    );
  });

  it('reads the versions once for a version page and its diff', async () => {
    const reads: string[] = [];

    const ledger: LedgerReader = {
      ...fixtureLedger,
      versions: (name) => {
        reads.push(name);

        return fixtureLedger.versions(name);
      },
    };

    await serve('/releases/lit-ui-router/1.10.0/', {}, ledger);

    assert.deepEqual(reads, ['lit-ui-router']);
  });

  it('links no diff for the first version', async () => {
    const doc = await page('/releases/lit-ui-router/1.2.0/');

    assert.equal(queryByRole(doc.body, 'link', { name: /^Diff from / }), null);
    assert.equal(queryByText(doc.body, 'Diff', { selector: 'dt' }), null);
    assert.equal(
      queryByText(doc.body, 'Published files', { selector: 'dt' }),
      null,
    );
  });

  it('renders the 404 page for a version the ledger lacks', async () => {
    const response = await serve('/releases/lit-ui-router/9.9.9/');

    getByRole(parseHtml((await response?.text()) ?? '').body, 'heading', {
      level: 1,
      name: 'Not found',
    });
  });

  it('links the stylesheet the docs build emits', async () => {
    const doc = await page('/releases/');

    // A link element has no role.
    assert.deepEqual(
      [...doc.querySelectorAll('link[rel="stylesheet"]')].map((link) =>
        link.getAttribute('href'),
      ),
      [STYLESHEET],
    );
    assert.ok(existsSync(join(import.meta.dirname, '../releases', STYLESHEET)));
  });

  it('escapes the head and keeps the body as rendered', async () => {
    const body = '<ui-view defer-hydration><p>a &amp; b</p></ui-view>';

    // A raw `</title>` would end the title early; `<b>` alone parses as title text either way.
    const title = 'a </title><b> & "c"';

    const doc = parseHtml(
      await releaseDocument(body, { title, description: 'd <e> & "f"' }),
    );

    assert.equal(doc.title, `${title} | Lit UI Router`);
    // A meta element has no role.
    assert.equal(
      doc.querySelector('meta[name="description"]')?.getAttribute('content'),
      'd <e> & "f"',
    );
    assert.ok(
      getByRole(doc.body, 'main').firstElementChild?.isEqualNode(
        parseHtml(`<div>${body}</div>`).body.firstElementChild,
      ),
    );
    assert.equal(doc.doctype?.name, 'html');
    assert.equal(doc.documentElement.lang, 'en');
  });

  it('loads the diff script the docs build emits on the diff page alone', async () => {
    const doc = await page(`${FILES}/1.9.0...1.10.0/`);

    // A script has no role.
    assert.deepEqual(
      [...doc.querySelectorAll('script[type="module"]')].map((script) =>
        script.getAttribute('src'),
      ),
      [DIFF_SCRIPT],
    );
    assert.ok(
      existsSync(
        join(
          import.meta.dirname,
          '../releases',
          DIFF_SCRIPT.replace(/\.js$/, '.ts'),
        ),
      ),
    );
  });

  it('ships only the appearance check as client script', async () => {
    const doc = await page('/releases/lit-ui-router/');

    // A script has no role.
    assert.deepEqual(
      [...doc.querySelectorAll('script:not([type="application/json"])')].map(
        (script) =>
          script
            .getAttributeNames()
            .map((name) => `${name}=${script.getAttribute(name)}`),
      ),
      [['id=check-dark-mode']],
    );
  });
});
