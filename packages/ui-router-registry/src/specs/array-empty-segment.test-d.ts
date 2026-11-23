// An array path param on an empty segment, as core 6.1 reads it back from the
// url. `tsc --noEmit` is the assertion; nothing runs this file.
import type { ParamsOf, ResolvedParamsOf, StatesOf } from '../index.js';

const emptySegmentStates = [
  { name: 'segcolon', url: '/segcolon/:ids', params: { ids: { array: true } } },
  { name: 'segsuffix', url: '/segsuffix/:ids[]' },
  { name: 'segcurly', url: '/segcurly/{ids[]}' },
  {
    name: 'segstring',
    url: '/segstring/{ids:string}',
    params: { ids: { array: true } },
  },
  {
    name: 'segjson',
    url: '/segjson/{ids:json}',
    params: { ids: { array: true } },
  },
  {
    name: 'segmid',
    url: '/segmid/:ids/tail',
    params: { ids: { array: true } },
  },
  {
    name: 'segconfigjson',
    url: '/segconfigjson/:ids',
    params: { ids: { array: true, type: 'json' } },
  },
  {
    name: 'segint',
    url: '/segint/{ids:int}',
    params: { ids: { array: true } },
  },
  { name: 'segintsuffix', url: '/segintsuffix/{ids[]:int}' },
  {
    name: 'segconfigint',
    url: '/segconfigint/:ids',
    params: { ids: { array: true, type: 'int' } },
  },
  {
    name: 'segbool',
    url: '/segbool/{ids:bool}',
    params: { ids: { array: true } },
  },
  {
    name: 'segregex',
    url: '/segregex/{ids:[0-9]+}',
    params: { ids: { array: true } },
  },
  {
    name: 'segdefault',
    url: '/segdefault/:ids',
    params: { ids: { array: true, value: ['x'] } },
  },
  {
    name: 'segsquash',
    url: '/segsquash/:ids',
    params: { ids: { array: true, value: ['x'], squash: true } },
  },
  {
    name: 'segnull',
    url: '/segnull/:ids',
    params: { ids: { array: true, value: null } },
  },
  {
    name: 'segscalar',
    url: '/segscalar/:ids[]',
    params: { 'ids[]': { array: false } },
  },
] as const;

declare module '../index.js' {
  interface RegisteredStates extends StatesOf<typeof emptySegmentStates> {}
}

declare function accepts<T>(value: T): T;

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// -- an element pattern that matches the empty segment reads back `undefined`

accepts<Equal<ResolvedParamsOf<'segcolon'>['ids'], string[] | undefined>>(true);

accepts<Equal<ResolvedParamsOf<'segsuffix'>['ids[]'], string[] | undefined>>(
  true,
);

accepts<Equal<ResolvedParamsOf<'segcurly'>['ids[]'], string[] | undefined>>(
  true,
);

accepts<Equal<ResolvedParamsOf<'segstring'>['ids'], string[] | undefined>>(
  true,
);

accepts<Equal<ResolvedParamsOf<'segjson'>['ids'], unknown[] | undefined>>(true);

accepts<Equal<ResolvedParamsOf<'segmid'>['ids'], string[] | undefined>>(true);

accepts<Equal<ResolvedParamsOf<'segconfigjson'>['ids'], unknown[] | undefined>>(
  true,
);

// The key stays required to read, and to pass.
accepts<Equal<Exclude<keyof ParamsOf<'segcolon'>, '#'>, 'ids'>>(true);

// @ts-expect-error the param is still required to pass
accepts<ParamsOf<'segcolon'>>({});

accepts<Equal<ParamsOf<'segcolon'>['ids'], string | readonly string[]>>(true);

// -- an element pattern that rejects the empty segment never matches it ------

accepts<Equal<ResolvedParamsOf<'segint'>['ids'], number[]>>(true);

accepts<Equal<ResolvedParamsOf<'segintsuffix'>['ids[]'], number[]>>(true);

accepts<Equal<ResolvedParamsOf<'segconfigint'>['ids'], number[]>>(true);

accepts<Equal<ResolvedParamsOf<'segbool'>['ids'], boolean[]>>(true);

accepts<Equal<ResolvedParamsOf<'segregex'>['ids'], string[]>>(true);

// -- a default fills the empty segment in, whatever the squash policy ---------

accepts<Equal<ResolvedParamsOf<'segdefault'>['ids'], string[]>>(true);

accepts<Equal<ResolvedParamsOf<'segsquash'>['ids'], string[]>>(true);

accepts<Equal<ResolvedParamsOf<'segnull'>['ids'], string[] | null>>(true);

// -- a scalar path param reads the empty segment back as `''` -----------------

accepts<Equal<ResolvedParamsOf<'segscalar'>['ids[]'], string>>(true);
