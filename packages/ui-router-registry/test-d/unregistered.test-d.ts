// Until an app registers, every type falls back to core's `string` and
// `RawParams`. `tsc --noEmit` is the assertion; nothing runs this file.
import type { RawParams, StateDeclaration } from '@uirouter/core';

import type {
  ParamsOf,
  StateName,
  TypedRouteSnapshot,
  TypedStateService,
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
