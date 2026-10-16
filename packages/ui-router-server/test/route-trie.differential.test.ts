import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { compileRoutes, matchRoute } from '../src/redirects.ts';
import type {
  CompiledRoute,
  RouteDeclaration,
  RouteMatch,
} from '../src/redirects.ts';
import { compileRouteTrie } from '../src/route-trie.ts';
import type { UrlMatcherCompilerConfig } from '../src/url-matcher.ts';

// The divergence guard for the trie: every route set/url pair runs through
// the trie and through matchRoute over the routes the trie expresses, and
// both must return the same match, or throw the same error.

// deepStrictEqual compares errors by prototype, name and message.
const settle = (run: () => RouteMatch | null): RouteMatch | null | Error => {
  try {
    return run();
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
};

interface DifferentialCase {
  label: string;
  routes: RouteDeclaration[];
  config?: UrlMatcherCompilerConfig;
  urls: string[];
  /** Names the trie must leave out; every other route must be expressed. */
  inexpressible?: string[];
}

const assertAgrees = ({
  routes,
  config,
  urls,
  inexpressible = [],
}: DifferentialCase): void => {
  const compiled = compileRoutes(routes, config);
  const trie = compileRouteTrie(compiled);

  assert.deepStrictEqual(
    trie.inexpressible.map(({ route }) => route.name),
    inexpressible,
  );
  const left = new Set(trie.inexpressible.map(({ route }) => route));
  const expressed = compiled.filter((route) => !left.has(route));

  for (const url of urls) {
    assert.deepStrictEqual(
      settle(() => trie.match(url)),
      settle(() => matchRoute(expressed, url)),
      `'${url}'`,
    );
  }
};

const appRoutes: RouteDeclaration[] = [
  { name: 'welcome', url: '/welcome' },
  { name: 'home', url: '/home' },
  { name: 'login', url: '/login' },
  { name: 'app', url: '' },
  { name: 'app.contacts', url: '/contacts' },
  { name: 'app.contacts.contact', url: '/:contactId' },
  { name: 'app.contacts.contact.edit', url: '/edit' },
  { name: 'app.contacts.new', url: '/new' },
  { name: 'app.mymessages', url: '/mymessages' },
  { name: 'app.mymessages.compose', url: '/compose' },
  { name: 'app.mymessages.messagelist', url: '/:folderId' },
  { name: 'app.mymessages.messagelist.message', url: '/:messageId' },
  { name: 'app.prefs', url: '/prefs' },
];

const appProbes = [
  '',
  '/',
  '/welcome',
  '/welcome/',
  '/Welcome',
  '/welcomeextra',
  '/home',
  '/login',
  '/prefs',
  '/contacts',
  '/contacts/',
  '/contacts/3',
  '/contacts/3/edit',
  '/contacts/3/edit/extra',
  '/contacts/new',
  '/contacts/b%20ob',
  '/mymessages',
  '/mymessages/compose',
  '/mymessages/inbox',
  '/mymessages/inbox/5',
  '/mymessages/inbox/5/extra',
  '/definitely-not-a-route',
];

const featureCases: DifferentialCase[] = [
  { label: 'the sample app', routes: appRoutes, urls: appProbes },
  {
    label: 'the sample app, not strict',
    routes: appRoutes,
    config: { strict: false },
    urls: [...appProbes, '/contacts/3/', '/contacts/3//', '/mymessages/a/b/'],
  },
  {
    label: 'empty and root patterns',
    routes: [
      { name: 'empty', url: '' },
      { name: 'root', url: '/' },
      { name: 'slashed', url: '/hello/' },
      { name: 'hello', url: '/hello' },
    ],
    urls: ['', '/', '//', '/hello', '/hello/', '/hello//', 'hello'],
  },
  {
    label: 'empty and root patterns, not strict',
    routes: [
      { name: 'empty', url: '' },
      { name: 'root', url: '/' },
      { name: 'slashed', url: '/hello/' },
      { name: 'hello', url: '/hello' },
    ],
    config: { strict: false },
    urls: ['', '/', '//', '/hello', '/hello/', '/hello//', 'hello'],
  },
  {
    label: 'typed params competing with static and untyped ones',
    routes: [
      { name: 'id', url: '/user/{id:int}' },
      { name: 'name', url: '/user/:name' },
      { name: 'me', url: '/user/me' },
      { name: 'flag', url: '/flag/{on:bool}' },
      { name: 'day', url: '/cal/{d:date}' },
      { name: 'hex', url: '/hex/{id:[0-9a-fA-F]{1,8}}' },
      { name: 'semver', url: '/v/{semver:\\d+\\.\\d+\\.\\d+}' },
    ],
    urls: [
      '/user/42',
      '/user/-7',
      '/user/4.2',
      '/user/me',
      '/user/',
      '/user/b%20ob',
      '/flag/1',
      '/flag/2',
      '/cal/2014-11-12',
      '/cal/2014-13-12',
      '/hex/deadBEEF',
      '/hex/123456789',
      '/v/1.2.3',
      '/v/1.2',
    ],
  },
  {
    label: 'params sharing a segment with static text',
    routes: [
      { name: 'json', url: '/v/:id.json' },
      { name: 'pair', url: '/v/:a-:b' },
      { name: 'plain', url: '/v/:id' },
      { name: 'static', url: '/v/latest.json' },
    ],
    urls: [
      '/v/1.json',
      '/v/latest.json',
      '/v/a-b-c',
      '/v/a-b.json',
      '/v/x',
      '/v/.json',
      '/v/-',
    ],
  },
  {
    label: 'squash policies',
    routes: [
      {
        name: 'docs',
        url: '/docs/:section/:page',
        params: {
          section: { value: 'intro', squash: true },
          page: { value: '1', squash: true },
        },
      },
      {
        name: 'tilde',
        url: '/t/:id',
        params: { id: { value: 'fallback', squash: '~' } },
      },
      {
        name: 'unsquashed',
        url: '/u/:id',
        params: { id: { value: 'fallback', squash: false } },
      },
      {
        name: 'mid',
        url: '/m/:id/edit',
        params: { id: { value: 'x', squash: true } },
      },
      {
        name: 'int',
        url: '/n/{id:int}',
        params: { id: { value: 42, squash: true } },
      },
      { name: 'docsSetup', url: '/docs/setup' },
    ],
    urls: [
      '/docs',
      '/docs/',
      '/docs/setup',
      '/docs/setup/',
      '/docs/setup/2',
      '/docs//2',
      '/docs/setup/2/3',
      '/t/~',
      '/t/other',
      '/t/',
      '/t',
      '/u',
      '/u/',
      '/u/7',
      '/m/edit',
      '/m//edit',
      '/m/7/edit',
      '/m',
      '/n',
      '/n/',
      '/n/7',
      '/n/x',
    ],
  },
  {
    label: 'squash policies, not strict',
    routes: [
      {
        name: 'docs',
        url: '/docs/:section/:page',
        params: {
          section: { value: 'intro', squash: true },
          page: { value: '1', squash: true },
        },
      },
      {
        name: 'mid',
        url: '/m/:id/edit',
        params: { id: { value: 'x', squash: true } },
      },
    ],
    config: { strict: false },
    urls: [
      '/docs',
      '/docs/',
      '/docs//',
      '/docs/setup/',
      '/docs/setup/2/',
      '/docs/setup/2//',
      '/m/edit/',
      '/m/7/edit/',
    ],
  },
  {
    label: 'a default squash policy',
    routes: [
      { name: 'x', url: '/x/:id', params: { id: 'fallback' } },
      { name: 'y', url: '/y/:a/:b', params: { a: 'one', b: 'two' } },
    ],
    config: { defaultSquashPolicy: true },
    urls: ['/x', '/x/', '/x/7', '/y', '/y/1', '/y/1/2', '/y//2'],
  },
  {
    label: 'adversarial static text',
    routes: [
      { name: 'plus', url: '/a+b' },
      { name: 'parens', url: '/a(b)c' },
      { name: 'dot', url: '/file.txt' },
      { name: 'pipe', url: '/a|b' },
      { name: 'anchors', url: '/$^' },
      { name: 'space', url: '/a b' },
      { name: 'cafe', url: '/café/:x' },
    ],
    urls: [
      '/a+b',
      '/ab',
      '/a(b)c',
      '/abc',
      '/file.txt',
      '/fileAtxt',
      '/a|b',
      '/a',
      '/$^',
      '/a b',
      '/a%20b',
      '/café/1',
      '/caf%C3%A9/1',
    ],
  },
  {
    label: 'search params never affect matching',
    routes: [
      { name: 'items', url: '/items/:id?sort' },
      { name: 'search', url: '/search?q&r' },
      { name: 'searchOnly', url: '?flag' },
    ],
    urls: ['/items/1', '/items/', '/search', '/searchq', '', '/'],
  },
  {
    label: 'routes the trie leaves out, mixed with ones it keeps',
    routes: [
      { name: 'files', url: '/files/*rest' },
      { name: 'file', url: '/files/:id' },
      { name: 'any', url: '/s/{v:string}' },
      { name: 'one', url: '/s/:v' },
      { name: 'index', url: '/s' },
    ],
    urls: ['/files/a', '/files/a/b', '/files/', '/s', '/s/x', '/s/x/y'],
    inexpressible: ['files', 'any'],
  },
  {
    label: 'a case-insensitive compiler',
    routes: [{ name: 'hello', url: '/hello' }],
    config: { caseInsensitive: true },
    urls: ['/hello', '/HELLO'],
    inexpressible: ['hello'],
  },
  {
    label: 'errors a matching route throws',
    routes: [
      { name: 'raw', url: '/files/%zz' },
      { name: 'decoded', url: '/files/:name' },
      {
        name: 'badDefault',
        url: '/n/{id:int}',
        params: { id: { value: 'nope', squash: true } },
      },
      { name: 'other', url: '/n/7' },
    ],
    urls: ['/files/%zz', '/files/ok', '/n', '/n/7', '/n/8'],
  },
];

// Every pattern of up to three pieces, probed with every url of up to four.
const pieces = ['/a', '/b', '/:p', '/{n:int}', '/a.json', '/:q.json'];

const probePieces = ['/a', '/b', '/1', '/a.json', '/1.json', '/', ''];

const sequences = (parts: string[], max: number): string[] => {
  let level = [''];
  const all = new Set(level);

  for (let length = 1; length <= max; length++) {
    level = level.flatMap((prefix) => parts.map((part) => prefix + part));
    level.forEach((item) => all.add(item));
  }

  return [...all];
};

const repeatsParam = (url: string): boolean =>
  ['/:p', '/{n:int}', '/:q'].some((param) => url.split(param).length > 2);

const generatedRoutes: RouteDeclaration[] = sequences(pieces, 3)
  .filter((url) => !repeatsParam(url))
  .map((url, index) => ({ name: `r${index}`, url }));

const generatedUrls = sequences(probePieces, 4);

const generatedCases: DifferentialCase[] = [
  {
    label: `${generatedRoutes.length} generated routes`,
    routes: generatedRoutes,
    urls: generatedUrls,
  },
  {
    label: `${generatedRoutes.length} generated routes, not strict`,
    routes: generatedRoutes,
    config: { strict: false },
    urls: generatedUrls,
  },
  {
    label: `${generatedRoutes.length} generated routes, squashed by default`,
    routes: generatedRoutes.map((route) => ({
      ...route,
      params: { p: 'dp', q: 'dq', n: 9 },
    })),
    config: { defaultSquashPolicy: true },
    urls: generatedUrls,
  },
];

const allCases = [...featureCases, ...generatedCases];

const comparisons = allCases.reduce((sum, c) => sum + c.urls.length, 0);

describe(`differential: route trie vs matchRoute (${allCases.length} route sets, ${comparisons} urls)`, () => {
  for (const testCase of allCases) {
    it(testCase.label, () => assertAgrees(testCase));
  }

  it('agrees with matchRoute over all routes when every route is expressed', () => {
    const compiled: CompiledRoute[] = compileRoutes(appRoutes);
    const trie = compileRouteTrie(compiled);

    for (const url of appProbes) {
      assert.deepStrictEqual(trie.match(url), matchRoute(compiled, url));
    }
  });
});
