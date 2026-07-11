import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findMjsFindings, formatReport } from './check-mjs.core.ts';

const allow = (entries: Record<string, string>) =>
  new Map(Object.entries(entries));

describe('findMjsFindings', () => {
  it('passes when nothing is tracked and nothing is allowlisted', () => {
    const findings = findMjsFindings([], allow({}));
    assert.deepEqual(findings, { unlisted: [], stale: [] });
  });

  it('flags tracked files missing from the allowlist, sorted', () => {
    const findings = findMjsFindings(['b.mjs', 'a.cjs'], allow({}));
    assert.deepEqual(findings.unlisted, ['a.cjs', 'b.mjs']);
    assert.deepEqual(findings.stale, []);
  });

  it('accepts allowlisted files', () => {
    const findings = findMjsFindings(
      ['tools/legacy.mjs'],
      allow({ 'tools/legacy.mjs': 'loader X cannot parse TS' }),
    );
    assert.deepEqual(findings, { unlisted: [], stale: [] });
  });

  it('flags stale allowlist entries so the list stays short', () => {
    const findings = findMjsFindings(
      [],
      allow({ 'gone.mjs': 'was needed once' }),
    );
    assert.deepEqual(findings.unlisted, []);
    assert.deepEqual(findings.stale, ['gone.mjs']);
  });
});

describe('formatReport', () => {
  it('reports ok with the allowlist size when clean', () => {
    const list = allow({ 'kept.mjs': 'reason' });
    const { ok, text } = formatReport(
      findMjsFindings(['kept.mjs'], list),
      list,
    );
    assert.equal(ok, true);
    assert.match(text, /mjs check passed/);
    assert.match(text, /1 allowlisted/);
  });

  it('names the file and both options for unlisted files', () => {
    const { ok, text } = formatReport(findMjsFindings(['new.mjs'], allow({})));
    assert.equal(ok, false);
    assert.match(text, /new\.mjs/);
    assert.match(text, /Convert it to \.ts/);
    assert.match(text, /MJS_ALLOWLIST/);
  });

  it('tells the fix for stale entries and reports not ok', () => {
    const list = allow({ 'gone.mjs': 'was needed once' });
    const { ok, text } = formatReport(findMjsFindings([], list), list);
    assert.equal(ok, false);
    assert.match(text, /gone\.mjs is allowlisted but no longer tracked/);
  });
});
