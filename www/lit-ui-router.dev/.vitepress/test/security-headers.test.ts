import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  ISOLATION_HEADERS,
  SECURITY_HEADERS,
} from '../../catalog/security-headers.ts';
import { snapshotHeaders } from '../snapshot.ts';

// https://developers.cloudflare.com/workers/static-assets/headers/
const LIMITS = { rules: 100, lineLength: 2000 } as const;

const NAMES = new Set(
  Object.keys(SECURITY_HEADERS).map((name) => name.toLowerCase()),
);

interface Rule {
  path: string;
  /** Lower-cased header name and value, in file order; a `! Name` line is a removal with no value. */
  lines: { name: string; value: string | null }[];
}

/** A `_headers` file as its rules: an unindented line opens one, each indented line under it sets or removes a header. */
function parseHeaders(text: string): Rule[] {
  const rules: Rule[] = [];

  for (const line of text.split('\n')) {
    const entry = line.trim();

    if (entry === '' || entry.startsWith('#')) continue;

    if (!/^\s/.test(line)) {
      rules.push({ path: entry, lines: [] });
      continue;
    }

    const rule = rules.at(-1);

    assert.ok(rule, `a header line before any rule: ${entry}`);

    if (entry.startsWith('!')) {
      rule.lines.push({
        name: entry.slice(1).trim().toLowerCase(),
        value: null,
      });
      continue;
    }

    const colon = entry.indexOf(':');

    assert.ok(colon > 0, `not a header line: ${entry}`);
    rule.lines.push({
      name: entry.slice(0, colon).trim().toLowerCase(),
      value: entry.slice(colon + 1).trim(),
    });
  }

  return rules;
}

const securityLines = (rule: Rule | undefined) =>
  Object.fromEntries(
    (rule?.lines ?? [])
      .filter(({ name }) => NAMES.has(name))
      .map(({ name, value }) => [name, value]),
  );

const expected = Object.fromEntries(
  Object.entries(SECURITY_HEADERS).map(([name, value]) => [
    name.toLowerCase(),
    value,
  ]),
);

describe('public/_headers', () => {
  const text = readFileSync(
    new URL('../../public/_headers', import.meta.url),
    'utf8',
  );

  const rules = parseHeaders(text);

  it('stays within the rule and line limits', () => {
    assert.ok(rules.length <= LIMITS.rules);
    assert.deepEqual(
      text.split('\n').filter((line) => line.length > LIMITS.lineLength),
      [],
    );
  });

  it('sets catalog/security-headers.ts on every path, each header once', () => {
    const all = rules.find(({ path }) => path === '/*');

    assert.deepEqual(securityLines(all), expected);
    assert.equal(
      all?.lines.filter(({ name }) => NAMES.has(name)).length,
      NAMES.size,
    );
  });

  it('isolates every path with the headers the worker sends on the snapshot lines', () => {
    const all = rules.find(({ path }) => path === '/*');

    for (const [header, value] of Object.entries(ISOLATION_HEADERS)) {
      const name = header.toLowerCase();

      assert.deepEqual(
        all?.lines.filter((line) => line.name === name),
        [{ name, value }],
      );
    }
  });

  // A header set by two matching rules is sent with both values joined.
  it('sets or removes none of them in a narrower rule', () => {
    for (const rule of rules.filter(({ path }) => path !== '/*'))
      assert.deepEqual(securityLines(rule), {}, rule.path);
  });

  it('keeps the set on every path of a snapshot baked under a prefix', () => {
    const baked = parseHeaders(snapshotHeaders(text, '/v1/'));

    assert.deepEqual(
      securityLines(baked.find(({ path }) => path === '/v1/*')),
      expected,
    );
  });
});
