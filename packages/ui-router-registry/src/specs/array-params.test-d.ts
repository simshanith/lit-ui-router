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
] as const;

declare module '../index.js' {
  interface RegisteredStates extends StatesOf<typeof arrayStates> {}
}

declare const stateService: TypedStateService;

/** Assignability probe: the call typechecks iff the argument satisfies T. */
declare function accepts<T>(value: T): T;

// -- passing: `array: true` and a `name[]` query key take an array -----------

void stateService.go('tags', { tag: ['a', 'b'] });

void stateService.go('ids', { 'id[]': ['a', 'b'] });

void stateService.go('pages', { ids: [1, 2] });

accepts<ParamsOf<'filters'>>({ flags: [true, false] });

// @ts-expect-error an array param takes an array, not one value
void stateService.go('tags', { tag: 'a' });

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
