import { UIRouter, type StateService } from '@uirouter/core';
import type {
  ParamsOf,
  ResolvedParamsOf,
  StateName,
  TypedRouteSnapshot,
  TypedStateService,
} from 'ui-router-registry';

declare const states: readonly [
  { readonly name: 'home'; readonly url: '/home' },
  { readonly name: 'item'; readonly url: '/item/{id:int}?tab' },
  {
    readonly name: 'item.edit';
    readonly url: '/edit';
    readonly params: { readonly draft: { readonly type: 'json' } };
  },
];

declare module 'ui-router-registry' {
  interface Register {
    states: (typeof states)[number];
  }
}

declare const stateService: TypedStateService;

declare const snapshot: TypedRouteSnapshot;

export const name: StateName = 'item.edit';

export const params: ParamsOf<'item.edit'> = {
  id: 1,
  tab: 'a',
  draft: { body: '' },
};

export const href: string = stateService.href('item', { id: 2 });

export const id: number | undefined = snapshot.includes('item')
  ? snapshot.params.id
  : undefined;

export const resolved: ResolvedParamsOf<'item'> = { id: 3 };

export const service: StateService = stateService;

export class TypedUIRouter extends UIRouter {
  declare stateService: TypedStateService;
}

export const router: UIRouter = new TypedUIRouter();

export const typed: TypedStateService = new UIRouter().stateService;
