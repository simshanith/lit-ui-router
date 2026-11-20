import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import worker from '../index.ts';
import { isMainAliasPath, redirectMainAlias } from '../main-alias.ts';

const ORIGIN = 'http://docs.test';

describe('isMainAliasPath', () => {
  it('claims the bare prefix and its subpaths only', () => {
    assert.ok(isMainAliasPath('/main'));
    assert.ok(isMainAliasPath('/main/'));
    assert.ok(isMainAliasPath('/main/guides/route-guards'));
    assert.ok(!isMainAliasPath('/mainline'));
    assert.ok(!isMainAliasPath('/main.html'));
    assert.ok(!isMainAliasPath('/guides/main/'));
    assert.ok(!isMainAliasPath('/v1/main/'));
  });
});

describe('redirectMainAlias', () => {
  const location = (path: string): string | null =>
    redirectMainAlias(new URL(`${ORIGIN}${path}`)).headers.get('Location');

  it('drops the prefix and keeps the rest of the path, temporarily', () => {
    const response = redirectMainAlias(
      new URL(`${ORIGIN}/main/guides/route-guards`),
    );

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), '/guides/route-guards');
    assert.equal(
      location('/main/reference/lit-ui-router/'),
      '/reference/lit-ui-router/',
    );
    assert.equal(location('/main/v1/'), '/v1/');
    assert.equal(location('/main/main/guides/'), '/main/guides/');
  });

  it('sends the bare prefix, with or without its slash, to the root', () => {
    assert.equal(location('/main'), '/');
    assert.equal(location('/main/'), '/');
  });

  it('keeps the query string', () => {
    assert.equal(location('/main?x=1'), '/?x=1');
    assert.equal(location('/main/?x=1'), '/?x=1');
    assert.equal(
      location('/main/guides/route-guards?x=1&y=a%20b'),
      '/guides/route-guards?x=1&y=a%20b',
    );
  });

  it('never names another origin', () => {
    for (const path of [
      '/main//evil.test/x',
      '/main///evil.test',
      '/main/\\evil.test',
      '/main/%2F%2Fevil.test',
    ]) {
      const target = location(path);

      assert.ok(target !== null, path);
      assert.equal(new URL(target, ORIGIN).origin, ORIGIN, path);
    }
  });
});

describe('the docs worker', () => {
  it('redirects /main and every /main/ path without reading a binding', async () => {
    // SAFETY: an alias request reads no binding; a read would throw on the missing member.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- an empty object shares no members with Env
    const env = {} as unknown as Env;

    // SAFETY: an alias request never touches the context.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- an empty object shares no members with ExecutionContext
    const ctx = {} as unknown as ExecutionContext;

    for (const [path, target] of [
      ['/main', '/'],
      ['/main/', '/'],
      ['/main/guides/route-guards?x=1', '/guides/route-guards?x=1'],
      ['/main/releases/lit-ui-router/', '/releases/lit-ui-router/'],
    ]) {
      for (const method of ['GET', 'HEAD']) {
        const response = await worker.fetch(
          new Request(`${ORIGIN}${path}`, { method }),
          env,
          ctx,
        );

        assert.equal(response.status, 302, path);
        assert.equal(response.headers.get('Location'), target, path);
      }
    }
  });
});
