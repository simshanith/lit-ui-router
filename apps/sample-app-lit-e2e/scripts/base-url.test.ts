import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveWwwDevPort } from '@www/lit-ui-router.dev/dev-port.ts';

import { e2eUrl, resolveE2eTarget } from './base-url.ts';

const local = `http://localhost:${resolveWwwDevPort()}`;

describe('resolveE2eTarget', () => {
  it('targets the local dev server when the override is blank', () => {
    for (const raw of ['', '  ']) {
      assert.deepEqual(resolveE2eTarget(raw), { origin: local, remote: false });
    }
  });

  it('takes an origin with or without a trailing slash', () => {
    for (const raw of [
      'https://lit-ui-router.dev',
      'https://lit-ui-router.dev/',
      ' https://lit-ui-router.dev/ ',
    ]) {
      assert.deepEqual(resolveE2eTarget(raw), {
        origin: 'https://lit-ui-router.dev',
        remote: true,
      });
    }
  });

  it('keeps an explicit port', () => {
    assert.equal(
      resolveE2eTarget('http://127.0.0.1:8801').origin,
      'http://127.0.0.1:8801',
    );
  });

  it('rejects what is not an absolute http(s) URL', () => {
    for (const raw of ['lit-ui-router.dev', '/app/', 'ftp://example.com']) {
      assert.throws(() => resolveE2eTarget(raw), /not an absolute http\(s\)/);
    }
  });

  it('rejects anything past the origin', () => {
    for (const raw of [
      'https://example.com/app/',
      'https://example.com/?preview=1',
      'https://example.com/#top',
      'https://user:secret@example.com',
    ]) {
      assert.throws(() => resolveE2eTarget(raw), /bare origin/);
    }
  });
});

describe('e2eUrl', () => {
  const target = { origin: 'https://example.com', remote: true };

  it('joins a mount under the origin, leading slash or not', () => {
    assert.equal(e2eUrl('app-mobx/', target), 'https://example.com/app-mobx/');
    assert.equal(e2eUrl('/app-mobx/', target), 'https://example.com/app-mobx/');
  });

  it('gives the site root for an empty path', () => {
    assert.equal(e2eUrl('', target), 'https://example.com/');
  });
});
