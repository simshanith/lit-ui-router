// Registry installed and Register augmented: the srefs take registered names and their params.
import { srefActiveClass, srefHref, uiSref, uiSrefActive } from 'lit-ui-router';
import type { UncheckedRef } from 'ui-router-registry';

const states = [
  { name: 'home', url: '/home' },
  { name: 'item', url: '/item/{id:int}' },
  { name: 'item.edit', url: '/edit' },
] as const;

declare module 'ui-router-registry' {
  interface Register {
    states: (typeof states)[number];
  }
}

declare const name: string;

declare const either: 'home' | 'item';

export const links = [
  uiSref('home'),
  uiSref('item', { id: 1 }, { reload: true }),
  uiSref('.edit'),
  srefHref('item.edit', { id: 2 }),
  uiSrefActive({ state: 'item', params: { id: 1 } }),
  // SAFETY: an opt-out on purpose; the name is one the registry can't see
  uiSref(name as UncheckedRef, { anything: 1 }),
  // @ts-expect-error a misspelled state name
  uiSref('itme', { id: 1 }),
  // @ts-expect-error a missing required param
  uiSref('item'),
  // @ts-expect-error a wrong param type: `{id:int}` is a number
  srefHref('item.edit', { id: '2' }),
  // @ts-expect-error a relative tail that ends no registered name
  uiSref('.edti'),
  uiSref('^.item'),
  // @ts-expect-error a parent-relative tail that ends no registered name
  uiSref('^.itme'),
  // Either name's params: `item`'s here.
  uiSrefActive({ state: either, params: { id: 1 } }),
  // @ts-expect-error neither name's params: `{id:int}` is a number
  uiSrefActive({ state: either, params: { id: '1' } }),
  // @ts-expect-error a misspelled state name
  srefActiveClass({ state: 'hom', activeClasses: ['active'] }),
];
