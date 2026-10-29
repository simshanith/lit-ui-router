import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isString } from '@uirouter/core';
import type {
  RawParams,
  StateDeclaration,
  StateRule,
  UIRouter,
} from '@uirouter/core';

import {
  compileRedirects,
  compileRoutes,
  evaluateRedirects,
  matchRoute,
} from '../src/redirects.ts';
import type { RedirectTable, RouteDeclaration } from '../src/redirects.ts';
import { createHeadlessRouter, onceSettled } from '../src/simulate.ts';
import { exec, format } from '../src/url-matcher.ts';

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
    assert.deepEqual(exec(compiled[1].matcher, '/contacts/3'), {
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

describe('compileRoutes: parent', () => {
  const patterns = (routes: RouteDeclaration[]) =>
    compileRoutes(routes).map(({ name, pattern }) => [name, pattern]);

  it('nests a parent: state under its parent url', () => {
    assert.deepEqual(
      patterns([
        { name: 'contacts', url: '/contacts' },
        { name: 'contactHelp', parent: 'contacts', url: '/help' },
      ]),
      [
        ['contacts', '/contacts'],
        ['contactHelp', '/contacts/help'],
      ],
    );
  });

  it('nests dotted children of a parent: state', () => {
    assert.deepEqual(
      patterns([
        { name: 'contacts', url: '/contacts' },
        { name: 'contactHelp', parent: 'contacts', url: '/help' },
        { name: 'contactHelp.topic', url: '/:topic' },
      ]).at(-1),
      ['contactHelp.topic', '/contacts/help/:topic'],
    );
  });

  it('follows a parent: chain through a url-less state', () => {
    assert.deepEqual(
      patterns([
        { name: 'app', url: '/app' },
        { name: 'shell', parent: 'app' },
        { name: 'shell.layout' },
        { name: 'inbox', parent: 'shell.layout', url: '/inbox' },
      ]),
      [
        ['app', '/app'],
        ['inbox', '/app/inbox'],
      ],
    );
  });

  it('merges params across a parent: link', () => {
    const [, help] = compileRoutes([
      {
        name: 'contacts',
        url: '/contacts/:section',
        params: { section: 'all' },
      },
      {
        name: 'contactHelp',
        parent: 'contacts',
        url: '/help/:topic',
        params: { topic: 'intro' },
      },
    ]);

    assert.deepEqual(exec(help.matcher, '/contacts/vip/help/search'), {
      section: 'vip',
      topic: 'search',
    });
    assert.equal(
      format(help.matcher, { section: 'all', topic: 'intro' }),
      '/contacts/all/help/intro',
    );
  });

  it('rejects an unknown parent, a cycle, and a dotted name with parent', () => {
    assert.throws(
      () => compileRoutes([{ name: 'help', parent: 'nope', url: '/help' }]),
      /Route 'help' has unknown parent 'nope'/,
    );
    assert.throws(
      () =>
        compileRoutes([
          { name: 'a', parent: 'b', url: '/a' },
          { name: 'b', parent: 'a', url: '/b' },
        ]),
      /parent cycle through 'a'/,
    );
    assert.throws(
      () => compileRoutes([{ name: 'a', parent: 'a', url: '/a' }]),
      /parent cycle through 'a'/,
    );
    assert.throws(
      () =>
        compileRoutes([
          { name: 'a', url: '/a' },
          { name: 'b', url: '/b' },
          { name: 'a.c', parent: 'b', url: '/c' },
        ]),
      /cannot have a '\.' in its name/,
    );
  });

  it('rejects a dotted name with parent, as core does', () => {
    const router = createHeadlessRouter([{ name: 'b', url: '/b' }]);

    assert.throws(
      () =>
        router.stateRegistry.register({ name: 'a.c', parent: 'b', url: '/c' }),
      /should not have a '\.' in their name/,
    );
  });

  it('redirects to a parent: state at its composed url', () => {
    const evaluate = compileRedirects({
      routes: [
        { name: 'contacts', url: '/contacts' },
        { name: 'contactHelp', parent: 'contacts', url: '/help/:topic' },
        { name: 'oldHelp', url: '/help/:topic', redirectTo: 'contactHelp' },
      ],
    });

    assert.equal(evaluate('/help/search'), '/contacts/help/search');
    assert.equal(evaluate('/contacts/help/search'), null);
  });
});

// Every url-bearing state's href from a headless core router must match back
// to that state through the matcher tier.
describe('differential: core href vs matcher, along parent', () => {
  const fixtures: [RouteDeclaration, RawParams][] = [
    [{ name: 'app', url: '' }, {}],
    [{ name: 'contacts', parent: 'app', url: '/contacts' }, {}],
    [{ name: 'contacts.contact', url: '/:contactId' }, { contactId: '7' }],
    [{ name: 'contactHelp', parent: 'contacts', url: '/help' }, {}],
    [{ name: 'contactHelp.topic', url: '/:topic' }, { topic: 'search' }],
    [{ name: 'shell', parent: 'app' }, {}],
    [{ name: 'shell.layout' }, {}],
    [{ name: 'inbox', parent: 'shell.layout', url: '/inbox' }, {}],
    [
      {
        name: 'folder',
        parent: 'inbox',
        url: '/:folderId',
        params: { folderId: { value: 'all', squash: true } },
      },
      { folderId: 'sent' },
    ],
    [{ name: 'message', parent: 'folder', url: '/m/:id' }, { id: '3' }],
    [{ name: 'prefs', parent: 'app', url: '/prefs?tab' }, { tab: 'mail' }],
  ];

  const routes = fixtures.map(([route]) => route);
  // Fresh declarations: core mutates registrations.
  const router = createHeadlessRouter(routes.map((route) => ({ ...route })));
  const compiled = compileRoutes(routes);

  for (const [route, params] of fixtures) {
    if (route.url === undefined) continue;

    it(route.name, () => {
      const href = router.stateService.href(route.name, params);
      const [path] = href.split('?');

      assert.equal(matchRoute(compiled, path)?.state, route.name, href);
      // SAFETY: every fixture url is a state url, so core's matching rule is a StateRule.
      const rule = router.urlService.match({ path })?.rule as StateRule;

      assert.equal(rule.state.name, route.name, href);
    });
  }
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

  it('prefers the more specific match (static beats placeholder)', () => {
    assert.deepEqual(matchRoute(compiled, '/contacts/new'), {
      state: 'contacts.new',
      params: {},
    });
  });

  it('returns null when nothing matches', () => {
    assert.equal(matchRoute(compiled, '/nope'), null);
    assert.equal(matchRoute(compiled, ''), null);
  });

  // Both patterns carry one param; the static-first pattern must win.
  it('orders by segment specificity, not param count or declaration order', () => {
    const routes = compileRoutes([
      { name: 'dynamicFirst', url: '/:x/b' },
      { name: 'staticFirst', url: '/a/:y' },
    ]);

    assert.deepEqual(matchRoute(routes, '/a/b'), {
      state: 'staticFirst',
      params: { y: 'b' },
    });
  });

  it('keeps declaration order only when specificity is genuinely equal', () => {
    const routes = compileRoutes([
      { name: 'first', url: '/:a/:b' },
      { name: 'second', url: '/:c/:d' },
    ]);

    assert.equal(matchRoute(routes, '/x/y')?.state, 'first');
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

  it('emits the redirect of the segment-specific route, not the first-declared', () => {
    const overlapping: RedirectTable = {
      routes: [
        // Declared first, but less specific at '/legacy/settings'.
        { name: 'section', url: '/legacy/:page', redirectTo: 'home' },
        { name: 'home', url: '/home' },
        // More specific: static 'settings' beats the ':page' placeholder.
        { name: 'settings', url: '/legacy/settings' },
      ],
    };

    // Both routes match; the specific one has no redirect, so serve as-is.
    assert.equal(evaluateRedirects(overlapping, '/legacy/settings'), null);
    // A non-overlapping page still redirects through 'section'.
    assert.equal(evaluateRedirects(overlapping, '/legacy/other'), '/home');
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
      { name: 'contactHelp', parent: 'contacts', url: '/help' },
      { name: 'oldHelp', url: '/help', redirectTo: 'contactHelp' },
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
    '/contacts/help',
    '/help',
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
      const to = isString(rule.to) ? { state: rule.to } : rule.to;

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
