import { Effect, SubscriptionRef } from 'effect';
import { UIRouter } from '@uirouter/core';
import { routeRef } from 'ui-router-effect';
import { RouterStore } from 'ui-router-mobx';
import type { AssertNoCollisions, StatesOf } from 'ui-router-registry';
import type {} from 'ui-router-registry/effect';
import type {} from 'ui-router-registry/mobx';
import type {} from 'ui-router-registry/signals';
import { RouterSignals } from 'ui-router-signals';

declare const states: readonly [
  { readonly name: 'home'; readonly url: '/home' },
  { readonly name: 'item'; readonly url: '/item/{id:int}?tab' },
  { readonly name: 'item.edit'; readonly url: '/edit' },
];

declare module 'ui-router-registry' {
  interface Register {
    states: (typeof states)[number];
  }
}

declare const accountStates: readonly [
  { readonly name: 'account'; readonly url: '/account' },
];

declare module 'ui-router-registry' {
  interface RegisteredStates extends StatesOf<typeof accountStates> {}
}

export type AccountStates = AssertNoCollisions<typeof accountStates>;

export type StaleAccountStates = AssertNoCollisions<
  // @ts-expect-error a second row under a registered name collides
  readonly [{ readonly name: 'account'; readonly url: '/me' }]
>;

const router = new UIRouter();

const signalsRoute = RouterSignals.for(router).route.get();

export const signalsId: number | undefined = signalsRoute.includes('item')
  ? signalsRoute.params.id
  : undefined;

const effectRoute = Effect.runSync(SubscriptionRef.get(routeRef(router)));

// `item.edit.help` is a `RegisteredStates` row under `Register`'s `item.edit`.
export const effectName: 'item' | 'item.edit' | 'item.edit.help' | undefined =
  effectRoute.includes('item') ? effectRoute.current.name : undefined;

const store = RouterStore.for(router);

export const storeTab: string | undefined = store.includes('item.edit')
  ? store.params.tab
  : undefined;

export const inItem: boolean = store.includes('item.**');

// @ts-expect-error a misspelled state name
export const misspelled: boolean = signalsRoute.includes('itme');
