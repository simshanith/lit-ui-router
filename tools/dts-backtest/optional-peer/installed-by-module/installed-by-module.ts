// Registry installed and RegisteredStates augmented per module: the srefs take every module's names and params.
import { srefActiveClass, srefHref, uiSref, uiSrefActive } from 'lit-ui-router';
import type { StatesOf } from 'ui-router-registry';

const homeStates = [{ name: 'home', url: '/home' }] as const;

const itemStates = [
  { name: 'item', url: '/item/{id:int}' },
  { name: 'item.edit', url: '/edit' },
] as const;

declare module 'ui-router-registry' {
  // oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type -- the members come from StatesOf
  interface RegisteredStates extends StatesOf<typeof homeStates> {}

  // oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type -- the members come from StatesOf
  interface RegisteredStates extends StatesOf<typeof itemStates> {}
}

export const links = [
  uiSref('home'),
  uiSref('item', { id: 1 }, { reload: true }),
  uiSref('.edit'),
  srefHref('item.edit', { id: 2 }),
  uiSrefActive({ state: 'item', params: { id: 1 } }),
  // @ts-expect-error a misspelled state name
  uiSref('itme', { id: 1 }),
  // @ts-expect-error a missing required param
  uiSref('item'),
  // @ts-expect-error a wrong param type: `{id:int}` is a number
  srefHref('item.edit', { id: '2' }),
  // @ts-expect-error a misspelled state name
  srefActiveClass({ state: 'hom', activeClasses: ['active'] }),
];
