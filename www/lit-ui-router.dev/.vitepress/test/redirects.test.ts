import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';

import { type ParseError, parse } from 'jsonc-parser';
import * as v from 'valibot';

import { REDIRECTS } from '../../catalog/redirects.ts';
import {
  builtProblems,
  matchRedirect,
  redirectLines,
  redirectsFileBody,
  spellings,
  tableProblems,
  workerFirstProblems,
} from '../redirects.ts';

const WranglerAssets = v.object({
  assets: v.object({
    run_worker_first: v.optional(
      v.union([
        v.pipe(
          v.boolean(),
          v.transform((all) => (all ? ['/*'] : [])),
        ),
        v.array(v.string()),
      ]),
      [],
    ),
  }),
});

function runWorkerFirst(): string[] {
  const errors: ParseError[] = [];

  const config: unknown = parse(
    readFileSync(join(import.meta.dirname, '../../wrangler.jsonc'), 'utf8'),
    errors,
    { allowTrailingComma: true },
  );

  assert.deepEqual(errors, []);

  return v.parse(WranglerAssets, config).assets.run_worker_first;
}

describe('catalog/redirects.ts', () => {
  const lines = redirectLines(REDIRECTS);

  it('stays within the limits, ordering, anchoring and chain rules', () => {
    assert.deepEqual(tableProblems(lines), []);
  });

  it('sends no source to the worker, where _redirects never applies', () => {
    const patterns = runWorkerFirst();

    assert.ok(patterns.length > 0);
    assert.deepEqual(workerFirstProblems(lines, patterns), []);
  });
});

describe('tableProblems', () => {
  it('flags a static rule after a dynamic one, a duplicate, an unanchored path, the snapshot prefix and a chain', () => {
    assert.deepEqual(
      tableProblems([
        { from: '/old/*', to: '/new/:splat', status: 301 },
        { from: '/a', to: '/b', status: 301 },
        { from: '/a', to: '/c', status: 301 },
        { from: 'x', to: 'https://example.com/', status: 301 },
        { from: '/v1/guide', to: '/guide', status: 301 },
        { from: '/b', to: '/d', status: 301 },
      ]),
      [
        'duplicate sources',
        '/a /b 301: static rule after a dynamic one',
        '/a /b 301: target is redirected again',
        '/a /c 301: static rule after a dynamic one',
        'x https://example.com/ 301: static rule after a dynamic one',
        'x https://example.com/ 301: not root-anchored',
        '/v1/guide /guide 301: static rule after a dynamic one',
        '/v1/guide /guide 301: source under /v1/',
        '/b /d 301: static rule after a dynamic one',
      ],
    );
  });

  it('flags a line over 1,000 characters and counts over the limits', () => {
    const long = `/${'a'.repeat(1000)}`;

    const many = Array.from({ length: 101 }, (_, i) => ({
      from: `/d${i}/*`,
      to: '/',
      status: 301,
    }));

    assert.deepEqual(tableProblems([{ from: long, to: '/', status: 301 }]), [
      `${long} / 301: over 1000 characters`,
    ]);
    assert.deepEqual(tableProblems(many), ['over 100 dynamic rules']);
  });
});

describe('workerFirstProblems', () => {
  it('flags sources under a pattern, honouring negations', () => {
    assert.deepEqual(
      workerFirstProblems(
        [
          { from: '/app/old', to: '/', status: 301 },
          { from: '/app/public/:page', to: '/', status: 301 },
          { from: '/docs', to: '/', status: 301 },
        ],
        ['/app/*', '!/app/public/*'],
      ),
      ['/app/old / 301: run_worker_first'],
    );
    assert.deepEqual(
      workerFirstProblems([{ from: '/docs', to: '/', status: 301 }], ['/*']),
      ['/docs / 301: run_worker_first'],
    );
  });
});

describe('matchRedirect', () => {
  const rules = [
    { from: '/exact', to: '/target/', status: 301 },
    { from: '/guide/:page/notes', to: '/notes/:page', status: 301 },
    { from: '/old/*', to: '/new/:splat', status: 302 },
  ];

  it('matches static, placeholder and splat sources, first match first', () => {
    assert.deepEqual(matchRedirect(rules, '/exact'), {
      location: '/target/',
      status: 301,
    });
    assert.deepEqual(matchRedirect(rules, '/guide/a/notes'), {
      location: '/notes/a',
      status: 301,
    });
    assert.deepEqual(matchRedirect(rules, '/old/a/b'), {
      location: '/new/a/b',
      status: 302,
    });
    assert.equal(matchRedirect(rules, '/exact/'), null);
    assert.equal(matchRedirect(rules, '/exactly'), null);
  });
});

describe('spellings', () => {
  it('adds the trailing-slash and .html spellings of a page, and the bare and index.html ones of a folder', () => {
    assert.deepEqual(
      spellings({ from: '/page', to: '/new/', status: 301 }).map(
        ({ from }) => from,
      ),
      ['/page', '/page/', '/page.html'],
    );
    assert.deepEqual(
      spellings({ from: '/folder/', to: '/new/', status: 301 }).map(
        ({ from }) => from,
      ),
      ['/folder/', '/folder', '/folder/index.html'],
    );
  });

  it('leaves files and dynamic sources alone', () => {
    for (const from of ['/page.md', '/old/*', '/guide/:page'])
      assert.deepEqual(spellings({ from, to: '/', status: 301 }), [
        { from, to: '/', status: 301 },
      ]);
  });
});

describe('redirectsFileBody', () => {
  it('writes one `from to status` line per rule', () => {
    assert.equal(
      redirectsFileBody([{ from: '/a', to: '/b/', status: 301 }]),
      '/a /b/ 301\n',
    );
  });
});

describe('builtProblems', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'redirects-'));

  for (const file of ['moved/index.html', 'page.html', 'copy.md', 'old.html']) {
    mkdirSync(dirname(join(outDir, file)), { recursive: true });
    writeFileSync(join(outDir, file), '');
  }

  it('passes targets that resolve to a file and sources that do not', () => {
    assert.deepEqual(
      builtProblems(
        [
          { from: '/gone', to: '/moved/', status: 301 },
          { from: '/gone-too', to: '/page', status: 301 },
          { from: '/gone.md', to: '/copy.md', status: 301 },
          { from: '/gone/*', to: '/nowhere/:splat', status: 301 },
        ],
        outDir,
      ),
      [],
    );
  });

  it('flags a dead target and a source a built file still answers', () => {
    assert.deepEqual(
      builtProblems(
        [
          { from: '/gone', to: '/missing', status: 301 },
          { from: '/old', to: '/page', status: 301 },
        ],
        outDir,
      ),
      [
        '/gone /missing 301: no built file at the target',
        '/old /page 301: a built file still answers the source',
      ],
    );
  });
});
