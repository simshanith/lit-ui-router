import { expect, it } from 'vitest';
import {
  memoryLocationPlugin,
  servicesPlugin,
  UIRouter,
  type StateDeclaration,
} from '@uirouter/core';

import { ancestorsOf, fold, type Tx } from '../fold.ts';
import { observe, type RouterEvent } from '../index.ts';
import { paramText, pathText, resultText } from '../notation.ts';

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

  const events: RouterEvent[] = [];
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

it('words each outcome from the result fields', async () => {
  const { txs } = await session(async ({ stateService, transitionService }) => {
    transitionService.onStart({ to: 'login' }, () => false);
    await stateService.go('mail').catch(() => {});
    await stateService.go('mail').catch(() => {});
    await stateService.go('login').catch(() => {});
    await stateService.go('typo').catch(() => {});
  });

  expect(txs.map(resultText)).toEqual([
    null,
    { head: 'Same state and params; pass reload: true to run it again' },
    { head: 'Aborted', detail: 'Hook aborted transition' },
    { head: "No state named 'typo'" },
  ]);
});

it('names invalid params and keeps the detail apart', () => {
  const tx = (result: Tx['result']): Tx => ({
    id: 4,
    t: 0,
    from: '',
    to: 'a',
    fromParams: {},
    toParams: {},
    entering: [],
    exiting: [],
    retained: [],
    redirectedFrom: null,
    options: {
      source: 'unknown',
      location: true,
      reload: false,
      inherit: true,
      supercede: true,
    },
    dynamic: false,
    marks: [],
    resolves: [],
    result,
  });

  expect(
    resultText(
      tx({
        t: 1,
        outcome: 'invalid',
        invalidParams: ['contactId'],
        message:
          "The following parameter values are not valid for state 'a': [contactId:undefined]",
      }),
    ),
  ).toEqual({
    head: 'Invalid param: contactId',
    detail:
      "The following parameter values are not valid for state 'a': [contactId:undefined]",
  });
  expect(resultText(tx({ t: 1, outcome: 'invalid' }))).toEqual({
    head: 'Invalid transition',
  });
  expect(resultText(tx({ t: 1, outcome: 'superseded', by: 7 }))).toEqual({
    head: 'Superseded by 007',
  });
  expect(
    resultText(tx({ t: 1, outcome: 'error', errorName: 'TypeError' })),
  ).toEqual({
    head: 'TypeError thrown',
  });
  expect(resultText(tx({ t: 1, outcome: 'error' }))).toEqual({
    head: 'A hook or resolve threw',
  });
});

it('prints array params as a list', () => {
  expect(paramText(['a', 1, null])).toBe('["a", 1, null]');
  expect(paramText(null)).toBe('');
  expect(paramText(3)).toBe('3');
});
