// Until an app registers, every type falls back to core's `string` and
// `RawParams`. `tsc --noEmit` is the assertion; nothing runs this file.
import type { RawParams, StateDeclaration, StateService } from '@uirouter/core';
import { UIRouter } from '@uirouter/core';
import type { TypedRouteSnapshot as EffectSnapshot } from 'ui-router-effect';
import type { RouterStore, TypedStoreName } from 'ui-router-mobx';
import type { TypedRouteSnapshot as SignalsSnapshot } from 'ui-router-signals';

import type {
  ParamsOf,
  RelativeRef,
  StateName,
  TypedRouteSnapshot,
  TypedStateService,
  UncheckedRef,
} from '../src/index.js';
import type {} from '../src/effect.js';
import type {} from '../src/mobx.js';
import type {} from '../src/signals.js';

declare const stateService: TypedStateService;

declare const snapshot: TypedRouteSnapshot;

declare function accepts<T>(value: T): T;

declare const name: string;

accepts<StateName>(name);

accepts<ParamsOf<'anything'>>({ anything: 1 });

void stateService.go(name, { anything: 1 });

accepts<string>(stateService.href('anywhere'));

accepts<RawParams>(snapshot.params);

accepts<StateDeclaration | undefined>(snapshot.current);

if (snapshot.includes('anything')) accepts<RawParams>(snapshot.params);

accepts<StateService>(stateService);

accepts<TypedStateService>(new UIRouter().stateService);

interface TypedRouter extends UIRouter {
  stateService: TypedStateService;
}

declare const typedRouter: TypedRouter;

accepts<UIRouter>(typedRouter);

accepts<RelativeRef>('.anything.at.all');

accepts<RelativeRef>('^.^.^.^.deep');

void stateService.go('.anywhere', { anything: 1 });

// SAFETY: an opt-out on purpose; unregistered, any name is accepted anyway
const uncheckedName = name as UncheckedRef;

void stateService.go(uncheckedName, { anything: 1 });

if (snapshot.includes(uncheckedName)) accepts<RawParams>(snapshot.params);

// With the adapter entry points loaded but nothing registered, the adapters
// keep their untyped shapes.
declare const signalsSnapshot: SignalsSnapshot;

accepts<RawParams>(signalsSnapshot.params);

accepts<StateDeclaration | undefined>(signalsSnapshot.current);

if (signalsSnapshot.includes('anything')) {
  accepts<RawParams>(signalsSnapshot.params);
}

declare const effectSnapshot: EffectSnapshot;

accepts<RawParams>(effectSnapshot.params);

accepts<StateDeclaration | undefined>(effectSnapshot.current);

declare const store: RouterStore;

accepts<RawParams>(store.params);

accepts<StateDeclaration | undefined>(store.current);

accepts<boolean>(store.includes(name, { anything: 1 }));

accepts<boolean>(store.includes('anything.**'));

declare const noName: TypedStoreName;

accepts<never>(noName);
