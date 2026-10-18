// Until an app registers, every type falls back to core's `string` and
// `RawParams`. `tsc --noEmit` is the assertion; nothing runs this file.
import type { RawParams, StateDeclaration } from '@uirouter/core';

import { srefHref, uiSref, uiSrefActive } from 'lit-ui-router';

import type {
  ParamsOf,
  RelativeRef,
  StateName,
  TypedRouteSnapshot,
  TypedStateService,
  UncheckedRef,
} from '../src/index.js';

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

accepts<RelativeRef>('.anything.at.all');

accepts<RelativeRef>('^.^.^.^.deep');

void stateService.go('.anywhere', { anything: 1 });

// SAFETY: an opt-out on purpose; unregistered, any name is accepted anyway
const uncheckedName = name as UncheckedRef;

void stateService.go(uncheckedName, { anything: 1 });

if (snapshot.includes(uncheckedName)) accepts<RawParams>(snapshot.params);

// With ui-router-registry/lit loaded but nothing registered, lit-ui-router's
// directives keep today's types.
uiSref(name, { anything: 1 }, { reload: true });

srefHref(name);

uiSrefActive({ state: name, params: { anything: 1 } });
