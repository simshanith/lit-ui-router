import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

import { LLMS_TXT_IGNORE } from '../llms.ts';

describe('LLMS_TXT_IGNORE', () => {
  // Mirrors the plugin: page paths (`reference/<pkg>/index.md` becomes `reference/<pkg>.md`), with `!` patterns as exceptions.
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
      'reference.md',
      'reference/lit-ui-router.md',
      'reference/ui-router-server.md',
      'reference/ui-router-registry.md',
      'reference/lit-ui-router-ssr.md',
    ]) {
      assert.equal(ignored(pagePath), false, pagePath);
    }
  });

  it("drops a multi-entry reference's root module, which matches the same sidebar link as its index", () => {
    for (const pagePath of [
      'reference/ui-router-server/index.md',
      'reference/ui-router-registry/index.md',
      'reference/lit-ui-router-ssr/index.md',
    ]) {
      assert.equal(ignored(pagePath), true, pagePath);
    }
  });

  it('drops member pages', () => {
    for (const pagePath of [
      'reference/ui-router-server/connect.md',
      'reference/lit-ui-router/classes/UIRouterLit.md',
    ]) {
      assert.equal(ignored(pagePath), true, pagePath);
    }
  });
});
