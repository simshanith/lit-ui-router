import { expect, it } from 'vitest';
import {
  memoryLocationPlugin,
  servicesPlugin,
  UIRouter,
  type StateDeclaration,
} from '@uirouter/core';

import { ancestorsOf } from '../fold.ts';
import { fold, observe, type DevtoolsEvent } from '../index.ts';
import { pathText, reasonParts } from '../notation.ts';

const states: StateDeclaration[] = [
  { name: 'app' },
  { name: 'login', parent: 'app' },
  { name: 'mail', parent: 'app' },
  { name: 'mail.list' },
  { name: 'mail.list.item' },
  { name: 'lazy.**', parent: 'app' },
];

const session = async (run: (router: UIRouter) => Promise<void>) => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  router.stateService.defaultErrorHandler(() => {});

  for (const state of states) router.stateRegistry.register(state);

  const events: DevtoolsEvent[] = [];
  const stop = observe(router, (event) => events.push(event));
  await run(router);
  stop();
  router.dispose();

  return fold(events);
};

it('finds ancestors through the declared parent, not the dotted name', async () => {
  const model = await session(async () => {});

  expect(ancestorsOf(model.states, 'mail.list.item')).toEqual([
    'mail.list',
    'mail',
    'app',
  ]);
  expect(ancestorsOf(model.states, 'lazy.**')).toEqual(['app']);
  expect(ancestorsOf(model.states, 'app')).toEqual([]);
  expect(ancestorsOf(model.states, 'missing')).toEqual([]);
});

it('names the deepest exited and the deepest entered state', async () => {
  const { txs } = await session(async ({ stateService }) => {
    await stateService.go('mail.list.item');
    await stateService.go('login');
    await stateService.go('mail.list', {}, { reload: true });
    await stateService.go('mail.list', {}, { reload: true });
  });

  expect(txs.map(pathText)).toEqual([
    '+ mail.list.item',
    'app − mail.list.item + login',
    // a reload retains nothing, so it exits and re-enters from the root
    '− login + mail.list',
    '− mail.list + mail.list',
  ]);
});

it('splits the message and the detail out of a rejection core printed', () => {
  expect(
    reasonParts(
      "Transition Rejection($id: 5 type: 4, message: This transition is invalid, detail: The following parameter values are not valid for state 'contacts.contact.edit': [contactId:undefined])",
    ),
  ).toEqual({
    head: 'This transition is invalid',
    detail:
      "The following parameter values are not valid for state 'contacts.contact.edit': [contactId:undefined]",
  });

  expect(
    reasonParts(
      'Transition Rejection($id: 2 type: 6, message: The transition errored, detail: undefined)',
    ),
  ).toEqual({ head: 'The transition errored' });

  expect(reasonParts('Resolve "horizon" rejected: no data escapes')).toEqual({
    head: 'Resolve "horizon" rejected: no data escapes',
  });
});
