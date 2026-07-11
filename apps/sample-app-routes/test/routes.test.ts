import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { UIRouter } from '@uirouter/core';

import {
  routePathPattern,
  routePathPatterns,
  routeSegments,
} from '../src/routes.ts';
import { matchAppRoute, matchesAppRoute } from '../src/matchers.ts';

const ACCEPTED = [
  '/welcome',
  '/home',
  '/login',
  '/prefs',
  '/contacts',
  '/contacts/3',
  '/contacts/3/edit',
  '/contacts/new',
  '/mymessages',
  '/mymessages/compose',
  '/mymessages/inbox',
  '/mymessages/inbox/5',
];

const REJECTED = [
  '/definitely-not-a-route',
  '/welcome/nope',
  '/contacts/3/edit/extra',
  '/mymessages/inbox/5/extra',
  '/welcomeextra',
  '/WELCOME',
];

describe('routePathPattern', () => {
  it('passes top-level segments through', () => {
    assert.equal(routePathPattern('welcome'), '/welcome');
    assert.equal(routePathPattern('prefs'), '/prefs');
  });

  it('joins url-bearing ancestors by dotted state name', () => {
    assert.equal(routePathPattern('contacts.contact'), '/contacts/:contactId');
    assert.equal(
      routePathPattern('contacts.contact.edit'),
      '/contacts/:contactId/edit',
    );
    assert.equal(
      routePathPattern('mymessages.messagelist.message'),
      '/mymessages/:folderId/:messageId',
    );
  });
});

describe('routePathPatterns', () => {
  it('covers every declared route name', () => {
    assert.equal(routePathPatterns.length, Object.keys(routeSegments).length);
  });
});

describe('matchesAppRoute', () => {
  it('accepts the app root, with or without the slash', () => {
    assert.equal(matchesAppRoute(''), true);
    assert.equal(matchesAppRoute('/'), true);
  });

  it('accepts static and parameterized routes', () => {
    for (const path of ACCEPTED) {
      assert.equal(matchesAppRoute(path), true, path);
    }
  });

  it('rejects paths no state url matches', () => {
    for (const path of REJECTED) {
      assert.equal(matchesAppRoute(path), false, path);
    }
  });

  // Differential leg: the standalone matcher behind matchesAppRoute must keep
  // the exact verdicts of urlMatcherFactory.compile, which the client router uses.
  it('agrees with a factory-compiled control on every path', () => {
    const { urlMatcherFactory } = new UIRouter();
    const control = routePathPatterns.map((pattern) =>
      urlMatcherFactory.compile(pattern),
    );
    for (const path of ['', '/', ...ACCEPTED, ...REJECTED]) {
      const controlVerdict =
        /^\/?$/.test(path) ||
        control.some((matcher) => matcher.exec(path) !== null);
      assert.equal(matchesAppRoute(path), controlVerdict, path);
    }
  });
});

describe('matchAppRoute', () => {
  it('names the matched state and extracts its params', () => {
    assert.deepEqual(matchAppRoute('/welcome'), {
      state: 'welcome',
      params: {},
    });
    assert.deepEqual(matchAppRoute('/prefs'), { state: 'prefs', params: {} });
    assert.deepEqual(matchAppRoute('/contacts/3'), {
      state: 'contacts.contact',
      params: { contactId: '3' },
    });
    assert.deepEqual(matchAppRoute('/contacts/3/edit'), {
      state: 'contacts.contact.edit',
      params: { contactId: '3' },
    });
    assert.deepEqual(matchAppRoute('/mymessages/inbox'), {
      state: 'mymessages.messagelist',
      params: { folderId: 'inbox' },
    });
    assert.deepEqual(matchAppRoute('/mymessages/inbox/5'), {
      state: 'mymessages.messagelist.message',
      params: { folderId: 'inbox', messageId: '5' },
    });
  });

  it('prefers static segments over placeholders, like the router', () => {
    // '/contacts/new' also satisfies '/contacts/:contactId'; identity must be
    // the static state, exactly as ui-router's rule ordering resolves it.
    assert.deepEqual(matchAppRoute('/contacts/new'), {
      state: 'contacts.new',
      params: {},
    });
    assert.deepEqual(matchAppRoute('/mymessages/compose'), {
      state: 'mymessages.compose',
      params: {},
    });
  });

  it('returns null for paths no state url matches', () => {
    for (const path of REJECTED) {
      assert.equal(matchAppRoute(path), null, path);
    }
  });

  it('returns null for the app root, which has no state url', () => {
    assert.equal(matchAppRoute(''), null);
    assert.equal(matchAppRoute('/'), null);
    // ...while matchesAppRoute still shells it (router.config.ts when-rule).
    assert.equal(matchesAppRoute('/'), true);
  });
});
