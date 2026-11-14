import { expect, it } from 'vitest';

import { stateMarks } from '../element/glyphs.ts';
import type { StateInfo } from '../schema.ts';

const state = (name: string, rest: Partial<StateInfo> = {}): StateInfo => ({
  name,
  parent: null,
  url: null,
  params: [],
  resolves: [],
  future: false,
  abstract: false,
  redirects: false,
  ...rest,
});

it('calls a redirect to a lazy child its default child', () => {
  const admin = state('admin', { redirects: true, redirectTo: 'admin.users' });
  const users = state('admin.users.**', { parent: 'admin', future: true });

  expect(stateMarks(admin, [admin, users])[0]).toMatchObject({
    mark: 'initial',
    term: 'Default child',
    text: 'admin.users',
  });
});

it('calls a redirect elsewhere a redirect', () => {
  const admin = state('admin', { redirects: true, redirectTo: 'home' });
  const home = state('home');

  expect(stateMarks(admin, [admin, home])[0]?.term).toBe('Redirects to');
});
