import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

import { LLMS_TXT_IGNORE } from '../llms.ts';

describe('LLMS_TXT_IGNORE', () => {
  // Mirrors the plugin: page paths (`api/<pkg>/index.md` becomes `api/<pkg>.md`), with `!` patterns as exceptions.
  const ignored = (pagePath: string) => {
    const matches = (pattern: string) =>
      path.posix.matchesGlob(pagePath, pattern.replace(/^!/, ''));

    return (
      LLMS_TXT_IGNORE.some((p) => !p.startsWith('!') && matches(p)) &&
      !LLMS_TXT_IGNORE.some((p) => p.startsWith('!') && matches(p))
    );
  };

  it('keeps each API index page', () => {
    for (const pagePath of [
      'api.md',
      'api/reference.md',
      'api/ui-router-server.md',
      'api/ui-router-registry.md',
      'api/lit-ui-router-ssr.md',
    ]) {
      assert.equal(ignored(pagePath), false, pagePath);
    }
  });

  it("drops a multi-entry reference's root module, which matches the same sidebar link as its index", () => {
    for (const pagePath of [
      'api/ui-router-server/index.md',
      'api/ui-router-registry/index.md',
      'api/lit-ui-router-ssr/index.md',
    ]) {
      assert.equal(ignored(pagePath), true, pagePath);
    }
  });

  it('drops member pages', () => {
    for (const pagePath of [
      'api/ui-router-server/connect.md',
      'api/reference/classes/UIRouterLit.md',
    ]) {
      assert.equal(ignored(pagePath), true, pagePath);
    }
  });
});
