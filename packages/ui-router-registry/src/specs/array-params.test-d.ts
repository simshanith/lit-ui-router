// `tsc --noEmit` is the assertion, so this file rides typecheck:tsc.
import type {
  ParamsOf,
  ResolvedParamsOf,
  StatesOf,
  TypedStateService,
} from '../index.js';

const arrayStates = [
  { name: 'tags', url: '/tags?tag', params: { tag: { array: true } } },
  { name: 'ids', url: '/ids?id[]' },
  { name: 'pages', url: '/pages/{ids:int}', params: { ids: { array: true } } },
  {
    name: 'single',
    url: '/single?one[]',
    params: { 'one[]': { array: false } },
  },
  { name: 'filters', params: { flags: { type: 'bool', array: true } } },
  {
    name: 'untyped',
    params: {
      tags: { array: true, value: 'all' },
      ids: { array: true, value: [1, 2] },
      none: { array: true, value: null },
      nonefn: { array: true, value: () => null },
      'keys[]': { value: 'k' },
    },
  },
  {
    name: 'typeddefault',
    params: { n: { type: 'int', array: true, value: 3 } },
  },
  {
    name: 'defaulted',
    url: '/defaulted?tag',
    params: { tag: { array: true, value: 'all' } },
  },
  { name: 'pathsuffix', url: '/pathsuffix/:ids[]' },
  { name: 'typedsuffix', url: '/typedsuffix/{ids[]:int}' },
  {
    name: 'auto',
    url: '/auto?tag',
    params: { tag: { array: 'auto' } },
  },
  {
    name: 'autosuffix',
    url: '/autosuffix?id[]',
    params: { 'id[]': { array: 'auto' } },
  },
  {
    name: 'emptydefault',
    url: '/emptydefault?tag',
    params: { tag: { array: true, value: '' } },
  },
] as const;

declare module '../index.js' {
  interface RegisteredStates extends StatesOf<typeof arrayStates> {}
}

declare const stateService: TypedStateService;

/** Assignability probe: the call typechecks iff the argument satisfies T. */
declare function accepts<T>(value: T): T;

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// -- passing: `array: true` and a `name[]` key take an array, or one value core wraps

void stateService.go('tags', { tag: ['a', 'b'] });

void stateService.go('ids', { 'id[]': ['a', 'b'] });

void stateService.go('pages', { ids: [1, 2] });

accepts<ParamsOf<'filters'>>({ flags: [true, false] });

void stateService.go('tags', { tag: 'a' });

void stateService.href('tags', { tag: 'a' });

void stateService.go('ids', { 'id[]': 'a' });

void stateService.go('pages', { ids: 1 });

void stateService.href('pages', { ids: 1 });

accepts<ParamsOf<'filters'>>({ flags: true });

// @ts-expect-error one value keeps the element type
void stateService.go('pages', { ids: '1' });

// @ts-expect-error the element keeps its placeholder type
void stateService.go('pages', { ids: ['1'] });

// an explicit `array: false` wins over the `[]` suffix, as in core
void stateService.go('single', { 'one[]': 'a' });

// @ts-expect-error an explicit `array: false` is a single value
void stateService.go('single', { 'one[]': ['a'] });

// -- reading back: core hands back an array -----------------------------------

declare const tags: ResolvedParamsOf<'tags'>;

accepts<string[] | undefined>(tags.tag);

accepts<ResolvedParamsOf<'ids'>['id[]']>(['a']);

// @ts-expect-error a `name[]` query key reads back an array
accepts<ResolvedParamsOf<'ids'>['id[]']>('a');

accepts<ResolvedParamsOf<'pages'>['ids']>([1]);

// @ts-expect-error an `array: true` path param reads back an array
accepts<ResolvedParamsOf<'pages'>['ids']>(1);

// A scalar default reads back wrapped after `go`, and as is after `transitionTo`.
accepts<Equal<ResolvedParamsOf<'defaulted'>['tag'], string[] | 'all'>>(true);

accepts<Equal<ResolvedParamsOf<'typeddefault'>['n'], number[] | 3>>(true);

accepts<ParamsOf<'defaulted'>>({ tag: 'other' });

accepts<
  Equal<ParamsOf<'typeddefault'>['n'], number | readonly number[] | undefined>
>(true);

// -- an untyped non-url param: the element type comes from the default -------

type Untyped = ResolvedParamsOf<'untyped'>;

// The default names the element type; a scalar one can also read back as is.
accepts<Equal<Untyped['tags'], string[] | 'all'>>(true);

accepts<Equal<Untyped['ids'], number[]>>(true);

accepts<Equal<Untyped['none'], unknown[] | null>>(true);

accepts<Equal<Untyped['nonefn'], unknown[] | null>>(true);

accepts<Equal<Untyped['keys[]'], string[] | 'k'>>(true);

accepts<ParamsOf<'untyped'>>({ tags: ['a'], 'keys[]': ['b'] });

accepts<ParamsOf<'untyped'>>({ tags: 'a', ids: 3 });

// @ts-expect-error one value keeps the default's element type
accepts<ParamsOf<'untyped'>>({ ids: 'a' });

// -- a `name[]` path placeholder ---------------------------------------------

// An empty segment reads back `undefined`.
accepts<Equal<ResolvedParamsOf<'pathsuffix'>['ids[]'], string[] | undefined>>(
  true,
);

accepts<Equal<ResolvedParamsOf<'typedsuffix'>['ids[]'], number[]>>(true);

void stateService.go('typedsuffix', { 'ids[]': [1, 2] });

void stateService.go('typedsuffix', { 'ids[]': 1 });

// @ts-expect-error the element keeps its placeholder type
void stateService.go('typedsuffix', { 'ids[]': ['1'] });

// -- a readonly array is accepted, and reads back mutable -------------------

void stateService.go('tags', { tag: ['a', 'b'] as const });

declare const readonlyTags: readonly string[];

void stateService.go('tags', { tag: readonlyTags });

void stateService.href('pages', { ids: [1, 2] as const });

accepts<Equal<ResolvedParamsOf<'tags'>['tag'], string[] | undefined>>(true);

// -- an explicit `array: 'auto'` reads back one value or an array -----------

accepts<Equal<ResolvedParamsOf<'auto'>['tag'], string | string[] | undefined>>(
  true,
);

// An explicit `array: 'auto'` beats the `[]` suffix: one value reads back unwrapped.
accepts<
  Equal<ResolvedParamsOf<'autosuffix'>['id[]'], string | string[] | undefined>
>(true);

void stateService.go('autosuffix', { 'id[]': ['a', 'b'] });

void stateService.go('autosuffix', { 'id[]': 'a' });

// -- an empty-string default reads back as is ---------------------------------

accepts<Equal<ResolvedParamsOf<'emptydefault'>['tag'], string[] | ''>>(true);
