import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { XMLParser } from 'fast-xml-parser';
import { SyntaxValidator } from 'fast-xml-validator';
import { createServerRouter } from 'ui-router-server';
import * as v from 'valibot';

import { SURFACES } from '../../catalog/surfaces.ts';
import { mounts } from '../../worker/releases/routes.ts';
import {
  childSitemaps,
  PAGES_SITEMAP,
  SITEMAP_INDEX,
  sitemapIndexXml,
  writeSitemapIndex,
} from '../sitemap.ts';

const HOST = 'https://lit-ui-router.dev';

const parser = new XMLParser({
  ignoreAttributes: false,
  ignoreDeclaration: true,
  parseTagValue: false,
  isArray: (name) => name === 'sitemap',
});

const ParsedIndex = v.strictObject({
  sitemapindex: v.strictObject({
    '@_xmlns': v.literal('http://www.sitemaps.org/schemas/sitemap/0.9'),
    sitemap: v.array(v.strictObject({ loc: v.string() })),
  }),
});

/** The `<loc>` of each `<sitemap>` in a parsed index; invalid XML fails the test. */
const indexLocs = (xml: string) => {
  assert.equal(SyntaxValidator.validate(xml), true);

  return v
    .parse(ParsedIndex, parser.parse(xml))
    .sitemapindex.sitemap.map(({ loc }) => loc);
};

describe('the sitemap index', () => {
  it('lists the pages sitemap and the releases sitemap', () => {
    assert.deepEqual(childSitemaps(), [PAGES_SITEMAP, '/releases/sitemap.xml']);
  });

  it('lists a worker row only while the catalog puts it in the sitemap', () => {
    const listed = SURFACES.filter(
      ({ renderer, sitemap }) => renderer === 'worker' && sitemap,
    ).map(({ paths: [mount] }) => `${mount}/sitemap.xml`);

    assert.deepEqual(childSitemaps().slice(1), listed);
  });

  it('points each worker sitemap at a response state the worker answers', async () => {
    const resolver = createServerRouter({ mounts });

    for (const path of childSitemaps().slice(1)) {
      const verdict = await resolver.resolve(new URL(path, HOST));

      assert.equal(verdict.kind, 'response', path);
      assert.equal(
        verdict.kind === 'response' && verdict.state,
        'releases.sitemap',
      );
    }
  });

  it('writes absolute locs', async () => {
    assert.deepEqual(indexLocs(await sitemapIndexXml(HOST, childSitemaps())), [
      `${HOST}/sitemap-pages.xml`,
      `${HOST}/releases/sitemap.xml`,
    ]);
  });

  it("moves VitePress's sitemap aside and writes the index in its place", async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'sitemap-'));

    try {
      await writeFile(join(outDir, SITEMAP_INDEX), '<urlset/>');
      await writeSitemapIndex(outDir, HOST);

      assert.equal(
        await readFile(join(outDir, PAGES_SITEMAP), 'utf8'),
        '<urlset/>',
      );
      assert.equal(
        indexLocs(await readFile(join(outDir, SITEMAP_INDEX), 'utf8'))[0],
        `${HOST}${PAGES_SITEMAP}`,
      );
    } finally {
      await rm(outDir, { recursive: true });
    }
  });
});
