import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { type ParseError, parse, printParseErrorCode } from 'jsonc-parser';
import * as v from 'valibot';
import { createTestHarness } from 'wrangler';

// The docs worker's bundle in workerd, its LEDGER binding served by the stub ledger worker over RPC.
const SITE = join(import.meta.dirname, '../..');

// wrangler writes its bundles under <root>/.wrangler; keep them out of the tree turbo hashes.
const SCRATCH = mkdtempSync(join(tmpdir(), 'docs-releases-'));

const WranglerConfig = v.object({
  name: v.string(),
  compatibility_date: v.string(),
  compatibility_flags: v.optional(v.array(v.string()), []),
  alias: v.record(v.string(), v.string()),
  services: v.tuple([
    v.object({
      binding: v.string(),
      service: v.string(),
      entrypoint: v.string(),
    }),
  ]),
});

const readSite = () => {
  const errors: ParseError[] = [];

  const config: unknown = parse(
    readFileSync(join(SITE, 'wrangler.jsonc'), 'utf8'),
    errors,
    { allowTrailingComma: true },
  );

  if (errors.length > 0) {
    throw new Error(
      `wrangler.jsonc: ${errors.map((e) => printParseErrorCode(e.error)).join(', ')}`,
    );
  }

  return v.parse(WranglerConfig, config);
};

const site = readSite();

const [ledger] = site.services;

const server = createTestHarness({
  root: SCRATCH,
  workers: [
    {
      config: {
        name: site.name,
        main: join(SITE, 'worker/index.ts'),
        compatibility_date: site.compatibility_date,
        compatibility_flags: site.compatibility_flags,
        // esbuild resolves an alias from the working directory, which here is SCRATCH.
        alias: Object.fromEntries(
          Object.entries(site.alias).map(([from, to]) => [
            from,
            join(SITE, to),
          ]),
        ),
        services: [ledger],
      },
    },
    {
      config: {
        name: ledger.service,
        main: join(SITE, 'worker/test/ledger-stub/index.ts'),
        compatibility_date: site.compatibility_date,
      },
    },
  ],
});

before(() => server.listen());

after(async () => {
  await server.close();
  rmSync(SCRATCH, { recursive: true, force: true });
});

describe('the release pages in workerd', { timeout: 120_000 }, () => {
  it('binds the ledger read-only, through its LedgerReader entrypoint', () => {
    assert.deepEqual(ledger, {
      binding: 'LEDGER',
      service: 'release-ledger',
      entrypoint: 'LedgerReader',
    });
  });

  it('renders a known version at 200', async () => {
    const response = await server.fetch('/releases/lit-ui-router/1.10.0/');
    const body = await response.text();

    assert.equal(response.status, 200, body);
    assert.match(
      body,
      /<title>lit-ui-router@1\.10\.0 \| Lit UI Router<\/title>/,
    );
    assert.match(body, /<ui-view defer-hydration>/);
  });

  it('answers 404 for a version the ledger lacks', async () => {
    const response = await server.fetch('/releases/lit-ui-router/9.9.9/');

    assert.equal(response.status, 404);
    assert.match(await response.text(), /<h1>Not found<\/h1>/);
  });

  it('redirects latest to the newest stable version', async () => {
    const response = await server.fetch('/releases/lit-ui-router/latest', {
      redirect: 'manual',
    });

    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get('Location'),
      '/releases/lit-ui-router/1.10.0/',
    );
  });

  it("redirects /gh latest to that version's GitHub release", async () => {
    const response = await server.fetch(
      '/gh/releases/ui-router-server/latest?ref=badge',
      { redirect: 'manual' },
    );

    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get('Location'),
      'https://github.com/simshanith/lit-ui-router/releases/tag/ui-router-server%400.3.0',
    );
  });

  it('answers 404 for the old /gh release pages', async () => {
    const response = await server.fetch('/gh/releases/');

    assert.equal(response.status, 404);
    assert.match(await response.text(), /<h1>Not found<\/h1>/);
  });
});
