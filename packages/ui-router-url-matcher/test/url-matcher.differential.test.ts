import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { services, UIRouter } from '@uirouter/core';

import { urlMatcherFactory } from '../src/url-matcher.ts';
import type { UrlMatcherCompileOptions } from '../src/url-matcher.ts';

// The divergence guard for the standalone extraction: every pattern/url pair
// runs through BOTH matchers and must produce identical verdicts and
// identical extracted params. If upstream semantics move, this suite is what
// notices.

// Core-side only: core routes static param defaults through services.$injector
// (params/param.ts) and throws without one. The standalone matcher is the
// control group — it never touches an injector.
services.$injector = {
  invoke: (fn: () => unknown) => fn(),
} as typeof services.$injector;

const { urlMatcherFactory: coreFactory } = new UIRouter();
const { compile } = urlMatcherFactory();

const coreCompile = (
  pattern: string,
  options: UrlMatcherCompileOptions = {},
) => {
  const config: Record<string, unknown> = {};
  if (options.strict !== undefined) config.strict = options.strict;
  if (options.caseInsensitive !== undefined)
    config.caseInsensitive = options.caseInsensitive;
  if (options.params !== undefined) config.state = { params: options.params };
  return coreFactory.compile(pattern, config);
};

interface DifferentialCase {
  pattern: string;
  options?: UrlMatcherCompileOptions;
  urls: string[];
}

// A nested-app pattern set (the sample apps' route shapes, kept as
// self-contained fixtures — the app-level parity leg against the live
// routeSegments lives in sample-app-routes' routes.test.ts). Every pattern
// must agree with core on the full url set, matches and rejections alike.
const appPatterns = [
  '/welcome',
  '/home',
  '/login',
  '/contacts',
  '/contacts/:contactId',
  '/contacts/:contactId/edit',
  '/contacts/new',
  '/mymessages',
  '/mymessages/compose',
  '/mymessages/:folderId',
  '/mymessages/:folderId/:messageId',
  '/prefs',
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

const appCases: DifferentialCase[] = appPatterns.map((pattern) => ({
  pattern,
  urls: appProbes,
}));

const featureCases: DifferentialCase[] = [
  // Static segments and trailing-slash strictness
  {
    pattern: '/hello',
    urls: ['/hello', '/hello/', '/HELLO', '/hello/x', 'hello', '/hell'],
  },
  { pattern: '/hello/', urls: ['/hello', '/hello/', '/hello//'] },
  { pattern: '/a/b/c', urls: ['/a/b/c', '/a/b', '/a/b/c/'] },
  { pattern: '', urls: ['', '/'] },
  { pattern: '/', urls: ['', '/', '//'] },
  {
    pattern: '/hello',
    options: { strict: false },
    urls: ['/hello', '/hello/', '/hello//'],
  },
  {
    pattern: '/hello/',
    options: { strict: false },
    urls: ['/hello', '/hello/', '/hello//'],
  },
  // Case sensitivity
  {
    pattern: '/hello',
    options: { caseInsensitive: true },
    urls: ['/HeLLo', '/hello', '/hell'],
  },
  {
    pattern: '/greet/:name',
    options: { caseInsensitive: true },
    urls: ['/GREET/Bob', '/greet/BOB'],
  },
  // Path params: colon and curly forms
  {
    pattern: '/user/:id',
    urls: [
      '/user/bob',
      '/user/',
      '/user',
      '/user/b%20ob',
      '/user/b.b-c_d',
      '/user/%E6%97%A5%E6%9C%AC',
      '/user/日本',
      '/user/bob/extra',
      '/user/bob%2Fdetails',
    ],
  },
  { pattern: '/user/{id}', urls: ['/user/bob', '/user/', '/user'] },
  { pattern: '/a/:x/:y', urls: ['/a/1/2', '/a/1', '/a/1/2/3', '/a//'] },
  { pattern: '/a/:x/mid/:y', urls: ['/a/1/mid/2', '/a/1/2', '/a/1/mid/'] },
  { pattern: '/f_1/:p_1', urls: ['/f_1/v_1', '/f_1/'] },
  // Typed params
  {
    pattern: '/user/{id:int}',
    urls: [
      '/user/42',
      '/user/-7',
      '/user/007',
      '/user/4.2',
      '/user/abc',
      '/user/',
      '/user/999999999999999999999',
    ],
  },
  {
    pattern: '/flag/{on:bool}',
    urls: ['/flag/1', '/flag/0', '/flag/2', '/flag/', '/flag/true'],
  },
  {
    pattern: '/cal/{d:date}',
    urls: [
      '/cal/2014-11-12',
      '/cal/2014-13-12',
      '/cal/2014-02-30',
      '/cal/14-1-1',
      '/cal/',
    ],
  },
  {
    pattern: '/n/{id:int}',
    options: { params: { id: { value: 42, squash: true } } },
    urls: ['/n', '/n/', '/n/7', '/n/x'],
  },
  { pattern: '/s/{v:string}', urls: ['/s/abc', '/s/a/b'] },
  // Inline regexps
  {
    pattern: '/hex/{id:[0-9a-fA-F]{1,8}}',
    urls: ['/hex/deadBEEF', '/hex/xyz', '/hex/123456789', '/hex/'],
  },
  {
    pattern: '/hex/{id:[0-9a-f]+}',
    options: { caseInsensitive: true },
    urls: ['/hex/DEAD', '/hex/dead'],
  },
  {
    pattern: '/v/{semver:\\d+\\.\\d+\\.\\d+}',
    urls: ['/v/1.2.3', '/v/1.2', '/v/1x2x3'],
  },
  // Catch-alls
  {
    pattern: '/files/*path',
    urls: ['/files/a/b/c', '/files/', '/files', '/files/a%2Fb'],
  },
  { pattern: '/files/{path:.*}', urls: ['/files/a/b/c', '/files/', '/files'] },
  // Query-suffixed patterns: never affect path matching, never throw
  { pattern: '/welcome?flag', urls: ['/welcome', '/welcome/', '/nope'] },
  { pattern: '/search?q&r', urls: ['/search', '/searchq'] },
  { pattern: '/x?{q:int}', urls: ['/x', '/y'] },
  { pattern: '/list?page-size', urls: ['/list'] },
  { pattern: '/items/:id?sort', urls: ['/items/1', '/items/'] },
  { pattern: '/q?', urls: ['/q', '/q?'] },
  { pattern: '/a?b/c', urls: ['/a', '/a?b/c'] },
  // Defaulted and squashed params
  {
    pattern: '/x/:id',
    options: { params: { id: { value: 'fallback', squash: true } } },
    urls: ['/x', '/x/', '/x/7', '/y', '/x/7/8'],
  },
  {
    pattern: '/x/:id',
    options: { params: { id: { value: 'fallback', squash: false } } },
    urls: ['/x', '/x/', '/x/7'],
  },
  {
    pattern: '/x/:id',
    options: { params: { id: { value: 'fallback', squash: '~' } } },
    urls: ['/x/~', '/x/other', '/x/', '/x'],
  },
  {
    pattern: '/x/:id',
    options: { params: { id: 'shorthand' } },
    urls: ['/x', '/x/', '/x/7'],
  },
  {
    pattern: '/docs/:section/:page',
    options: {
      params: {
        section: { value: 'intro', squash: true },
        page: { value: '1', squash: true },
      },
    },
    urls: ['/docs', '/docs/setup', '/docs/setup/2', '/docs/', '/docs/setup/'],
  },
  // Adversarial static segments (regexp metacharacters must be escaped)
  { pattern: '/a+b', urls: ['/a+b', '/ab', '/aab'] },
  { pattern: '/a(b)c', urls: ['/a(b)c', '/abc'] },
  { pattern: '/file.txt', urls: ['/file.txt', '/fileAtxt'] },
  { pattern: '/a|b', urls: ['/a|b', '/a', '/b'] },
  { pattern: '/$^', urls: ['/$^', '/'] },
  { pattern: '/a b', urls: ['/a b', '/a%20b'] },
  // Unicode static segments
  { pattern: '/café/:x', urls: ['/café/1', '/caf%C3%A9/1', '/cafe/1'] },
];

const allCases = [...appCases, ...featureCases];
const comparisons = allCases.reduce((sum, c) => sum + c.urls.length, 0);

describe(`differential: standalone matcher vs @uirouter/core (${allCases.length} patterns, ${comparisons} comparisons)`, () => {
  for (const { pattern, options, urls } of allCases) {
    const label = options ? `${pattern} ${JSON.stringify(options)}` : pattern;
    it(label, () => {
      const expectedMatcher = coreCompile(pattern, options);
      const actualMatcher = compile(pattern, options);
      for (const url of urls) {
        const expected: unknown = expectedMatcher.exec(url);
        const actual: unknown = actualMatcher.exec(url);
        assert.deepStrictEqual(actual, expected, `'${pattern}' × '${url}'`);
      }
    });
  }
});

// Cases where both implementations must refuse — at compile or at exec.
const throwCases: {
  label: string;
  pattern: string;
  options?: UrlMatcherCompileOptions;
  url?: string;
}[] = [
  { label: 'duplicate param name (colon/colon)', pattern: '/a/:x/:x' },
  { label: 'duplicate param name (colon/curly)', pattern: '/a/:x/{x}' },
  { label: 'duplicate across path and search', pattern: '/a/:x?x' },
  {
    label: 'inline regexp with a capture group',
    pattern: '/u/{id:(a|b)}',
    url: '/u/a',
  },
  {
    label: 'malformed percent-encoding in the url',
    pattern: '/user/:id',
    url: '/user/100%',
  },
  {
    label: 'invalid squash policy',
    pattern: '/x/:id',
    options: {
      params: { id: { value: 'v', squash: 5 as unknown as boolean } },
    },
    url: '/x/1',
  },
  {
    label: 'default value of the wrong type',
    pattern: '/n/{id:int}',
    options: { params: { id: { value: 'not-int', squash: true } } },
    url: '/n',
  },
];

describe('differential: rejected by both implementations', () => {
  for (const { label, pattern, options, url } of throwCases) {
    it(label, () => {
      assert.throws(
        () => coreCompile(pattern, options).exec(url ?? '/'),
        `core accepted: ${label}`,
      );
      assert.throws(
        () => compile(pattern, options).exec(url ?? '/'),
        `standalone accepted: ${label}`,
      );
    });
  }
});

// Divergences by design: the standalone matcher fails at compile where core
// supports features that are out of scope for pathname matching. Documented
// here so a scope change shows up as a test change.
describe('differential: standalone-only compile rejections (supported upstream)', () => {
  it('array params', () => {
    assert.ok(coreCompile('/a/{ids[]}'));
    assert.throws(
      () => compile('/a/{ids[]}'),
      /Array parameters are not supported/,
    );
  });

  it('function (injected) defaults', () => {
    const options = {
      params: { id: { value: () => 'fallback', squash: true } },
    };
    assert.deepStrictEqual(coreCompile('/x/:id', options).exec('/x'), {
      id: 'fallback',
    });
    assert.throws(
      () => compile('/x/:id', options),
      /Function \(injected\) defaults/,
    );
  });

  it('the json type', () => {
    assert.ok(coreCompile('/a/{x:json}'));
    assert.throws(() => compile('/a/{x:json}'), /not supported/);
  });

  it('replace configs', () => {
    const options = {
      params: { id: { value: 'v', replace: [{ from: 'a', to: 'b' }] } },
    };
    assert.ok(coreCompile('/a/:id', options));
    assert.throws(
      () => compile('/a/:id', options),
      /'replace' is not supported/,
    );
  });
});
