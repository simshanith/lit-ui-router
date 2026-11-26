// Query params in core 6.1's auto array mode. `tsc --noEmit` is the assertion;
// `test/array-auto.test.ts` runs the same shapes through core.
import type {
  ParamsOf,
  ResolvedParamsOf,
  StatesOf,
  TypedRouteSnapshot,
  TypedStateService,
} from '../index.js';

const autoStates = [
  { name: 'qplain', url: '/qplain?id' },
  { name: 'qcurly', url: '/qcurly?{n:int}' },
  {
    name: 'qauto',
    url: '/qauto?id',
    params: { id: { array: 'auto' } },
  },
  {
    name: 'qautoint',
    url: '/qautoint?id',
    params: { id: { array: 'auto', type: 'int' } },
  },
  {
    name: 'qautocurly',
    url: '/qautocurly?{n:int}',
    params: { n: { array: 'auto' } },
  },
  {
    name: 'qautodefault',
    url: '/qautodefault?id',
    params: { id: { array: 'auto', value: 'x' } },
  },
  {
    name: 'qautonull',
    url: '/qautonull?id',
    params: { id: { array: 'auto', value: null, squash: true } },
  },
  {
    name: 'qautodynamic',
    url: '/qautodynamic?id',
    params: { id: { array: 'auto', dynamic: true, raw: true } },
  },
  {
    name: 'qplaindefault',
    url: '/qplaindefault?id',
    params: { id: 'x' },
  },
  {
    name: 'qplaintyped',
    url: '/qplaintyped?id',
    params: { id: { type: 'int' } },
  },
  {
    name: 'qmixed',
    url: '/qmixed/:path?auto&plain&many&one',
    params: {
      auto: { array: 'auto' },
      many: { array: true },
      one: { array: false },
    },
  },
  { name: 'qmixed.child', url: '/child?extra' },
  {
    name: 'qpathauto',
    url: '/qpathauto/:id',
    params: { id: { array: 'auto' } },
  },
  { name: 'qconfigauto', params: { id: { array: 'auto' } } },
] as const;

declare module '../index.js' {
  interface RegisteredStates extends StatesOf<typeof autoStates> {}
}

declare const stateService: TypedStateService;

declare const snapshot: TypedRouteSnapshot;

declare function accepts<T>(value: T): T;

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

declare const readonlyIds: readonly string[];

// -- a query param that leaves `array` unset takes one value or an array -----

accepts<
  Equal<ParamsOf<'qplain'>['id'], string | readonly string[] | undefined>
>(true);

void stateService.go('qplain', { id: 'a' });

void stateService.go('qplain', { id: ['a', 'b'] });

void stateService.go('qplain', { id: readonlyIds });

void stateService.go('qplain', { id: ['a', 'b'] as const });

void stateService.transitionTo('qplain', { id: ['a', 'b'] });

void stateService.target('qplain', { id: ['a', 'b'] });

void stateService.href('qplain', { id: ['a', 'b'] });

stateService.is('qplain', { id: ['a', 'b'] });

stateService.includes('qplain', { id: ['a', 'b'] });

// @ts-expect-error an element keeps the param's type
void stateService.go('qplain', { id: [1] });

// @ts-expect-error one value keeps the param's type
void stateService.href('qplain', { id: 1 });

void stateService.go('qcurly', { n: [1, 2] });

// @ts-expect-error an element keeps its placeholder type
void stateService.go('qcurly', { n: ['1'] });

accepts<
  Equal<ParamsOf<'qplaintyped'>['id'], number | readonly number[] | undefined>
>(true);

accepts<
  Equal<ParamsOf<'qplaindefault'>['id'], string | readonly string[] | undefined>
>(true);

// -- ...and reads back one value, an approximation of core -------------------

accepts<Equal<ResolvedParamsOf<'qplain'>['id'], string | undefined>>(true);

accepts<Equal<ResolvedParamsOf<'qcurly'>['n'], number | undefined>>(true);

accepts<Equal<ResolvedParamsOf<'qplaintyped'>['id'], number | undefined>>(true);

accepts<Equal<ResolvedParamsOf<'qplaindefault'>['id'], string>>(true);

// -- an explicit `array: 'auto'` takes and reads back one value or an array --

accepts<Equal<ParamsOf<'qauto'>['id'], string | readonly string[] | undefined>>(
  true,
);

accepts<Equal<ResolvedParamsOf<'qauto'>['id'], string | string[] | undefined>>(
  true,
);

void stateService.go('qauto', { id: ['a', 'b'] });

void stateService.transitionTo('qauto', { id: readonlyIds });

void stateService.target('qauto', { id: 'a' });

void stateService.href('qauto', { id: ['a'] as const });

// @ts-expect-error an element keeps the param's type
void stateService.go('qauto', { id: [true] });

// A declared `type` names the element.
accepts<
  Equal<ParamsOf<'qautoint'>['id'], number | readonly number[] | undefined>
>(true);

accepts<
  Equal<ResolvedParamsOf<'qautoint'>['id'], number | number[] | undefined>
>(true);

// @ts-expect-error an element keeps the declared type
void stateService.go('qautoint', { id: ['1'] });

accepts<
  Equal<ResolvedParamsOf<'qautocurly'>['n'], number | number[] | undefined>
>(true);

// A default fills the param in, so it reads back present.
accepts<Equal<ResolvedParamsOf<'qautodefault'>['id'], string | string[]>>(true);

accepts<ParamsOf<'qautodefault'>>({});

accepts<Equal<ResolvedParamsOf<'qautonull'>['id'], string | string[] | null>>(
  true,
);

accepts<ParamsOf<'qautonull'>>({ id: null });

accepts<
  Equal<ResolvedParamsOf<'qautodynamic'>['id'], string | string[] | undefined>
>(true);

// -- neighbours keep their own modes -----------------------------------------

type Mixed = ResolvedParamsOf<'qmixed'>;

accepts<Equal<Mixed['auto'], string | string[] | undefined>>(true);

accepts<Equal<Mixed['plain'], string | undefined>>(true);

accepts<Equal<Mixed['many'], string[] | undefined>>(true);

accepts<Equal<Mixed['one'], string | undefined>>(true);

accepts<Equal<Mixed['path'], string>>(true);

accepts<Equal<ParamsOf<'qmixed'>['path'], string>>(true);

accepts<
  Equal<ParamsOf<'qmixed'>['plain'], string | readonly string[] | undefined>
>(true);

accepts<
  Equal<ParamsOf<'qmixed'>['many'], string | readonly string[] | undefined>
>(true);

accepts<Equal<ParamsOf<'qmixed'>['one'], string | undefined>>(true);

// @ts-expect-error an explicit `array: false` is a single value
void stateService.go('qmixed', { path: 'p', one: ['a'] });

// @ts-expect-error a path param stays a single value
void stateService.go('qmixed', { path: ['p'] });

// -- a child inherits its parent's modes -------------------------------------

type Child = ResolvedParamsOf<'qmixed.child'>;

accepts<Equal<Child['auto'], string | string[] | undefined>>(true);

accepts<Equal<Child['plain'], string | undefined>>(true);

accepts<Equal<Child['extra'], string | undefined>>(true);

void stateService.go('qmixed.child', {
  path: 'p',
  auto: ['a', 'b'],
  plain: ['a', 'b'],
  extra: ['a', 'b'],
});

if (snapshot.includes('qmixed')) {
  accepts<string | string[] | undefined>(snapshot.params.auto);

  // @ts-expect-error an unset `array` reads back scalar
  accepts<string | undefined>(snapshot.params.auto);
}

// -- core throws on `array: 'auto'` outside the query; it is not an array ---

accepts<Equal<ResolvedParamsOf<'qpathauto'>['id'], string>>(true);

accepts<Equal<ParamsOf<'qpathauto'>['id'], string>>(true);

accepts<Equal<ResolvedParamsOf<'qconfigauto'>['id'], never>>(true);
