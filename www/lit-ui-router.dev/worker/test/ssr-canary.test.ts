import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

import { type ParseError, parse, printParseErrorCode } from 'jsonc-parser';
import * as v from 'valibot';
import { createTestHarness } from 'wrangler';

// Bundles each fixture with wrangler and serves it from workerd under the docs worker's compatibility settings.
const FIXTURES = join(import.meta.dirname, 'ssr-canary');

// wrangler writes its bundles under <root>/.wrangler; keep them out of the tree turbo hashes.
const SCRATCH = mkdtempSync(join(tmpdir(), 'ssr-canary-'));

after(() => rmSync(SCRATCH, { recursive: true, force: true }));

const WranglerConfig = v.object({
  compatibility_date: v.string(),
  compatibility_flags: v.optional(v.array(v.string()), []),
});

const readSite = () => {
  const source = readFileSync(
    join(import.meta.dirname, '../../wrangler.jsonc'),
    'utf8',
  );

  const errors: ParseError[] = [];
  const config: unknown = parse(source, errors, { allowTrailingComma: true });

  if (errors.length > 0) {
    throw new Error(
      `wrangler.jsonc: ${errors.map((e) => printParseErrorCode(e.error)).join(', ')}`,
    );
  }

  return v.parse(WranglerConfig, config);
};

const site = readSite();

const serve = (main: string, compatibilityFlags: string[]) =>
  createTestHarness({
    root: SCRATCH,
    workers: [
      {
        config: {
          name: 'ssr-canary',
          main: join(FIXTURES, main),
          compatibility_date: site.compatibility_date,
          compatibility_flags: compatibilityFlags,
        },
      },
    ],
  });

const render = async (main: string, compatibilityFlags: string[]) => {
  const server = serve(main, compatibilityFlags);

  try {
    await server.listen();
    const response = await server.fetch('/');

    return { status: response.status, body: await response.text() };
  } finally {
    await server.close();
  }
};

const assertCard = ({ status, body }: { status: number; body: string }) => {
  assert.equal(status, 200, body);
  assert.match(body, /<canary-card\s+heading="Hello">/);
  assert.match(body, /<template shadowroot="open" shadowrootmode="open">/);
  assert.match(body, /:host\s*{\s*display: block;\s*}/);
  assert.match(body, /<h2><!--lit-part-->Hello<!--\/lit-part--><\/h2>/);
  assert.match(body, /<\/template>A post<\/canary-card>/);
};

describe('lit SSR in workerd', { timeout: 120_000 }, () => {
  it("renders with @lit-labs/ssr-dom-shim globals under the site's flags", async () => {
    assertCard(await render('light-shim.js', site.compatibility_flags));
  });

  it('renders with install-global-dom-shim under nodejs_compat', async () => {
    assertCard(
      await render('global-shim.js', [
        ...site.compatibility_flags,
        'nodejs_compat',
      ]),
    );
  });

  it(
    'install-global-dom-shim cannot start without nodejs_compat',
    {
      skip:
        site.compatibility_flags.includes('nodejs_compat') &&
        'the site already enables nodejs_compat',
    },
    async () => {
      await assert.rejects(
        render('global-shim.js', site.compatibility_flags),
        /node:fs/,
      );
    },
  );
});
