import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { RawParams, StateDeclaration, UIRouter } from '@uirouter/core';

import {
  compileRedirects,
  compileRoutes,
  evaluateRedirects,
  matchRoute,
} from '../src/redirects.ts';
import type { RedirectTable } from '../src/redirects.ts';
import { createHeadlessRouter, onceSettled } from '../src/simulate.ts';

describe('compileRoutes', () => {
  it('appends nested urls along dotted names and merges params rootward', () => {
    const compiled = compileRoutes([
      { name: 'contacts', url: '/contacts' },
      { name: 'contacts.detail', url: '/:contactId' },
      { name: 'contacts.detail.edit', url: '/edit' },
    ]);
    assert.deepEqual(
      compiled.map((route) => route.pattern),
      ['/contacts', '/contacts/:contactId', '/contacts/:contactId/edit'],
    );
    assert.deepEqual(compiled[1].matcher.exec('/contacts/3'), {
      contactId: '3',
    });
  });

  it('skips url-less states but nests through them', () => {
    const compiled = compileRoutes([
      { name: 'app' },
      { name: 'app.home', url: '/home' },
    ]);
    assert.deepEqual(
      compiled.map((route) => route.name),
      ['app.home'],
    );
    assert.equal(compiled[0].pattern, '/home');
  });

  it('rejects duplicate names, missing ancestors, and non-leaf search params', () => {
    assert.throws(
      () =>
        compileRoutes([
          { name: 'a', url: '/a' },
          { name: 'a', url: '/b' },
        ]),
      /Duplicate route 'a'/,
    );
    assert.throws(
      () => compileRoutes([{ name: 'a.b', url: '/b' }]),
      /no ancestor 'a'/,
    );
    assert.throws(
      () => compileRoutes([{ name: 'a', url: 'a' }]),
      /must start with '\/' or '\?'/,
    );
    assert.throws(
      () =>
        compileRoutes([
          { name: 'a', url: '/a?q' },
          { name: 'a.b', url: '/b' },
        ]),
      /already has search params/,
    );
  });
});

describe('matchRoute', () => {
  const compiled = compileRoutes([
    { name: 'contacts', url: '/contacts' },
    { name: 'contacts.detail', url: '/:contactId' },
    { name: 'contacts.new', url: '/new' },
  ]);

  it('reports match identity with extracted params', () => {
    assert.deepEqual(matchRoute(compiled, '/contacts/3'), {
      state: 'contacts.detail',
      params: { contactId: '3' },
    });
  });

  it('prefers the match with the fewest params (static beats placeholder)', () => {
    assert.deepEqual(matchRoute(compiled, '/contacts/new'), {
      state: 'contacts.new',
      params: {},
    });
  });

  it('returns null when nothing matches', () => {
    assert.equal(matchRoute(compiled, '/nope'), null);
    assert.equal(matchRoute(compiled, ''), null);
  });
});

describe('evaluateRedirects', () => {
  const table: RedirectTable = {
    routes: [
      { name: 'welcome', url: '/welcome' },
      { name: 'home', url: '/home' },
      { name: 'legacy', url: '/legacy', redirectTo: 'home' },
      { name: 'contacts', url: '/contacts' },
      { name: 'contacts.detail', url: '/:contactId' },
      {
        name: 'old',
        url: '/old/:contactId',
        redirectTo: 'contacts.detail',
      },
      { name: 'chain', url: '/chain', redirectTo: 'legacy' },
      {
        name: 'pinned',
        url: '/pinned',
        redirectTo: { state: 'contacts.detail', params: { contactId: '1' } },
      },
    ],
    rules: [
      { pattern: /^\/?$/, to: 'welcome' },
      { pattern: '/moved/:contactId', to: 'contacts.detail' },
    ],
  };

  it('redirects via pattern rules (RegExp and matcher-pattern strings)', () => {
    assert.equal(evaluateRedirects(table, ''), '/welcome');
    assert.equal(evaluateRedirects(table, '/'), '/welcome');
    assert.equal(evaluateRedirects(table, '/moved/3'), '/contacts/3');
  });

  it('redirects via state redirectTo, carrying matched params', () => {
    assert.equal(evaluateRedirects(table, '/legacy'), '/home');
    assert.equal(evaluateRedirects(table, '/old/3'), '/contacts/3');
  });

  it('replaces params when the target declares them', () => {
    assert.equal(evaluateRedirects(table, '/pinned'), '/contacts/1');
  });

  it('follows redirect chains', () => {
    assert.equal(evaluateRedirects(table, '/chain'), '/home');
  });

  it('returns null for plain and unknown paths', () => {
    assert.equal(evaluateRedirects(table, '/home'), null);
    assert.equal(evaluateRedirects(table, '/contacts/3'), null);
    assert.equal(evaluateRedirects(table, '/nope'), null);
  });

  it('returns null when target params fail validation', () => {
    const typed: RedirectTable = {
      routes: [
        { name: 'page', url: '/page/{num:int}' },
        { name: 'old', url: '/old/:num', redirectTo: 'page' },
      ],
    };
    assert.equal(evaluateRedirects(typed, '/old/3'), '/page/3');
    assert.equal(evaluateRedirects(typed, '/old/x'), null);
  });

  it('rejects unknown targets and cycles at compile', () => {
    assert.throws(
      () =>
        compileRedirects({
          routes: [{ name: 'a', url: '/a', redirectTo: 'nope' }],
        }),
      /unknown or url-less state 'nope'/,
    );
    assert.throws(
      () =>
        compileRedirects({
          routes: [
            { name: 'a', url: '/a', redirectTo: 'nope' },
            { name: 'nope' },
          ],
        }),
      /unknown or url-less state 'nope'/,
    );
    assert.throws(
      () =>
        compileRedirects({
          routes: [
            { name: 'a', url: '/a', redirectTo: 'b' },
            { name: 'b', url: '/b', redirectTo: 'a' },
          ],
        }),
      /Redirect cycle/,
    );
  });
});

// The trust pattern that made the matcher credible, extended up a layer: the
// declarative evaluator and a headless router are driven by the SAME
// declarations, and must agree on every probe — the redirect target when one
// engine redirects, and null (no address change) when it does not.
describe('differential: evaluator vs headless simulation', () => {
  const table: RedirectTable = {
    routes: [
      { name: 'welcome', url: '/welcome' },
      { name: 'home', url: '/home' },
      { name: 'legacy', url: '/legacy', redirectTo: 'home' },
      { name: 'contacts', url: '/contacts' },
      { name: 'contacts.detail', url: '/:contactId' },
      { name: 'contacts.new', url: '/new' },
      { name: 'old', url: '/old/:contactId', redirectTo: 'contacts.detail' },
      { name: 'chain', url: '/chain', redirectTo: 'legacy' },
      {
        name: 'pinned',
        url: '/pinned',
        redirectTo: { state: 'contacts.detail', params: { contactId: '1' } },
      },
    ],
    rules: [
      { pattern: /^\/?$/, to: 'welcome' },
      { pattern: '/moved/:contactId', to: 'contacts.detail' },
    ],
  };

  const probes = [
    '',
    '/',
    '/welcome',
    '/home',
    '/legacy',
    '/contacts',
    '/contacts/3',
    '/contacts/new',
    '/old/3',
    '/moved/3',
    '/chain',
    '/pinned',
    '/nope',
    '/contacts/3/nope',
  ];

  // The control: replay the pathname through a headless router built from
  // the same table. The memory location only moves when the client's address
  // bar would (core skips the url push for url-sourced transitions), so
  // "landed !== path" is the router's own redirect verdict.
  async function control(path: string): Promise<string | null> {
    // Fresh declarations per router: core mutates registrations.
    const states: StateDeclaration[] = table.routes.map((route) => ({
      ...route,
    }));
    const router: UIRouter = createHeadlessRouter(states);
    for (const rule of table.rules ?? []) {
      const to = typeof rule.to === 'string' ? { state: rule.to } : rule.to;
      if (rule.pattern instanceof RegExp) {
        router.urlService.rules.when(rule.pattern, () => ({
          state: to.state,
          params: to.params,
        }));
      } else {
        router.urlService.rules.when(rule.pattern, (params: RawParams) => ({
          state: to.state,
          params: { ...params, ...to.params },
        }));
      }
    }
    if (!router.urlService.match({ path, search: {}, hash: '' })) return null;
    const settled = onceSettled(router);
    router.urlService.url(path);
    router.urlService.sync();
    if (!(await settled)) return null;
    const landed = router.urlService.url();
    return landed === path ? null : landed;
  }

  const evaluate = compileRedirects(table);
  for (const probe of probes) {
    it(`'${probe}'`, async () => {
      assert.equal(evaluate(probe), await control(probe), `probe '${probe}'`);
    });
  }
});
