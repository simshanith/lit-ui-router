// Array params inside the placeholders the url scanner reads, as core 6.1
// types them after `go`. `tsc --noEmit` is the assertion; nothing runs this file.
import type {
  ParamsOf,
  ResolvedParamsOf,
  StateName,
  StatesOf,
  TypedStateService,
} from '../index.js';

const arrayPlaceholderStates = [
  {
    name: 'arraysegment',
    url: '/item-{ids:int}',
    params: { ids: { array: true } },
  },
  { name: 'arraysuffix', url: '/x/:ids[]' },
  {
    name: 'arrayregexquery',
    url: '/q?{tag:[^&]*}',
    params: { tag: { array: true } },
  },
  { name: 'arraycatchall', url: '/files/*path' },
  {
    name: 'arrayrange',
    url: '/range/{from}-{to}',
    params: { from: { array: true } },
  },
] as const;

declare module '../index.js' {
  interface RegisteredStates extends StatesOf<typeof arrayPlaceholderStates> {}
}

declare const stateService: TypedStateService;

declare function accepts<T>(value: T): T;

type Keys<N extends StateName> = Exclude<keyof ParamsOf<N>, '#'>;

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// -- a same-segment placeholder declared `array: true` ------------------------

accepts<Equal<Keys<'arraysegment'>, 'ids'>>(true);

accepts<Equal<ResolvedParamsOf<'arraysegment'>['ids'], number[]>>(true);

accepts<Equal<ParamsOf<'arraysegment'>['ids'], number | number[]>>(true);

void stateService.go('arraysegment', { ids: [1, 2] });

void stateService.go('arraysegment', { ids: 3 });

// @ts-expect-error the element keeps its placeholder type
void stateService.go('arraysegment', { ids: ['1'] });

// -- a `name[]` path placeholder ----------------------------------------------

accepts<Equal<Keys<'arraysuffix'>, 'ids[]'>>(true);

accepts<Equal<ResolvedParamsOf<'arraysuffix'>['ids[]'], string[]>>(true);

void stateService.go('arraysuffix', { 'ids[]': 'a' });

// -- a regex query placeholder declared `array: true` -------------------------

accepts<Equal<Keys<'arrayregexquery'>, 'tag'>>(true);

accepts<
  Equal<ResolvedParamsOf<'arrayregexquery'>['tag'], string[] | undefined>
>(true);

void stateService.go('arrayregexquery', { tag: ['a', 'b'] });

void stateService.go('arrayregexquery', { tag: 'a' });

void stateService.go('arrayregexquery');

// -- a catch-all stays one value ----------------------------------------------

accepts<Equal<ResolvedParamsOf<'arraycatchall'>['path'], string>>(true);

// @ts-expect-error a catch-all takes one value
void stateService.go('arraycatchall', { path: ['a', 'b'] });

// -- one of two placeholders in a segment declared `array: true` --------------

accepts<Equal<Keys<'arrayrange'>, 'from' | 'to'>>(true);

accepts<Equal<ResolvedParamsOf<'arrayrange'>['from'], string[]>>(true);

accepts<Equal<ResolvedParamsOf<'arrayrange'>['to'], string>>(true);

void stateService.go('arrayrange', { from: ['a', 'b'], to: 'c' });

void stateService.go('arrayrange', { from: 'a', to: 'c' });

// @ts-expect-error only `from` is an array
void stateService.go('arrayrange', { from: 'a', to: ['c'] });

// @ts-expect-error both placeholders in one segment are required
void stateService.go('arrayrange', { from: ['a'] });
