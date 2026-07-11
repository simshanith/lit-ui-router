import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  routePathPattern,
  routePathPatterns,
  routeSegments,
} from './routes.ts';
import { matchesAppRoute } from './routeMatchers.ts';

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
    for (const path of [
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
    ]) {
      assert.equal(matchesAppRoute(path), true, path);
    }
  });

  it('rejects paths no state url matches', () => {
    for (const path of [
      '/definitely-not-a-route',
      '/welcome/nope',
      '/contacts/3/edit/extra',
      '/mymessages/inbox/5/extra',
      '/welcomeextra',
    ]) {
      assert.equal(matchesAppRoute(path), false, path);
    }
  });
});
