// An array path param on an empty segment, as core 6.1 reads it back from the
// url. `tsc --noEmit` is the assertion; nothing runs this file.
import type { ParamType } from '@uirouter/core';

import type { ParamsOf, ResolvedParamsOf, StatesOf } from '../index.js';

declare const customType: ParamType;

declare const unionUrl: '/segunion/:ids' | '/segunion/{ids:int}';

declare const unionIntUrl: '/segunionint/{ids:int}' | '/segunionint/{ids:bool}';

declare const wideArray: boolean;

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
    name: 'segany',
    url: '/segany/{ids:any}',
    params: { ids: { array: true } },
  },
  {
    name: 'segpath',
    url: '/segpath/{ids:path}',
    params: { ids: { array: true } },
  },
  {
    name: 'segconfigpath',
    url: '/segconfigpath/:ids',
    params: { ids: { array: true, type: 'path' } },
  },
  { name: 'segstar', url: '/segstar/*ids', params: { ids: { array: true } } },
  { name: 'segstar.child', url: '/child' },
  { name: 'segtypedsuffix', url: '/segtypedsuffix/{ids[]:path}' },
  {
    name: 'segsuffixjson',
    url: '/segsuffixjson/:ids[]',
    params: { 'ids[]': { type: 'json' } },
  },
  {
    name: 'segsquashonly',
    url: '/segsquashonly/:ids',
    params: { ids: { array: true, squash: true } },
  },
  {
    name: 'segdate',
    url: '/segdate/{ids:date}',
    params: { ids: { array: true } },
  },
  {
    name: 'segconfigquery',
    url: '/segconfigquery/:ids',
    params: { ids: { array: true, type: 'query' } },
  },
  {
    name: 'segconfighash',
    url: '/segconfighash/:ids',
    params: { ids: { array: true, type: 'hash' } },
  },
  {
    name: 'segquery',
    url: '/segquery/{ids:query}',
    params: { ids: { array: true } },
  },
  {
    name: 'segscalarquery',
    url: '/segscalarquery/:ids',
    params: { ids: { type: 'query' } },
  },
  {
    name: 'segundef',
    url: '/segundef/:ids',
    params: { ids: { array: true, value: undefined } },
  },
  {
    name: 'segfnundef',
    url: '/segfnundef/:ids',
    params: { ids: { array: true, value: () => undefined } },
  },
  {
    name: 'segfndefault',
    url: '/segfndefault/:ids',
    params: { ids: { array: true, value: () => ['x'] } },
  },
  {
    name: 'segqueryundef',
    url: '/segqueryundef?ids',
    params: { ids: { value: undefined } },
  },
  {
    name: 'segquerydefault',
    url: '/segquerydefault?ids',
    params: { ids: { value: 'x' } },
  },
  {
    name: 'segcustom',
    url: '/segcustom/:ids',
    params: { ids: { array: true, type: customType } },
  },
  {
    name: 'segunion',
    url: unionUrl,
    params: { ids: { array: true } },
  },
  {
    name: 'segunionint',
    url: unionIntUrl,
    params: { ids: { array: true } },
  },
  {
    name: 'segwidearray',
    url: '/segwidearray/:ids',
    params: { ids: { array: wideArray } },
  },
  {
    name: 'segwidedefault',
    url: '/segwidedefault/:ids',
    params: { ids: { array: wideArray, value: ['x'] } },
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

accepts<Equal<ResolvedParamsOf<'segany'>['ids'], unknown[] | undefined>>(true);

accepts<Equal<ResolvedParamsOf<'segpath'>['ids'], string[] | undefined>>(true);

accepts<Equal<ResolvedParamsOf<'segconfigpath'>['ids'], string[] | undefined>>(
  true,
);

accepts<Equal<ResolvedParamsOf<'segstar'>['ids'], string[] | undefined>>(true);

// A child inherits the read-back.
accepts<Equal<ResolvedParamsOf<'segstar.child'>['ids'], string[] | undefined>>(
  true,
);

accepts<
  Equal<ResolvedParamsOf<'segtypedsuffix'>['ids[]'], string[] | undefined>
>(true);

accepts<
  Equal<ResolvedParamsOf<'segsuffixjson'>['ids[]'], unknown[] | undefined>
>(true);

// `squash` with no `value` leaves the param without a default.
accepts<Equal<ResolvedParamsOf<'segsquashonly'>['ids'], string[] | undefined>>(
  true,
);

accepts<Equal<ResolvedParamsOf<'segconfigquery'>['ids'], string[] | undefined>>(
  true,
);

accepts<Equal<ResolvedParamsOf<'segconfighash'>['ids'], string[] | undefined>>(
  true,
);

accepts<Equal<ResolvedParamsOf<'segquery'>['ids'], string[] | undefined>>(true);

// A default that is, or returns, `undefined` fills nothing in.
accepts<Equal<ResolvedParamsOf<'segundef'>['ids'], string[] | undefined>>(true);

accepts<Equal<ResolvedParamsOf<'segfnundef'>['ids'], string[] | undefined>>(
  true,
);

// Each url of a union reads back as its own placeholder does.
accepts<
  Equal<ResolvedParamsOf<'segunion'>['ids'], (string | number)[] | undefined>
>(true);

// A widened `array: boolean` may be an array.
accepts<
  Equal<ResolvedParamsOf<'segwidearray'>['ids'], string | string[] | undefined>
>(true);

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

accepts<Equal<ResolvedParamsOf<'segdate'>['ids'], Date[]>>(true);

accepts<Equal<ResolvedParamsOf<'segunionint'>['ids'], (number | boolean)[]>>(
  true,
);

// A custom type's pattern is unknown, so it keeps its declared type.
accepts<Equal<ResolvedParamsOf<'segcustom'>['ids'], string[]>>(true);

// -- a default fills the empty segment in, whatever the squash policy ---------

accepts<Equal<ResolvedParamsOf<'segdefault'>['ids'], string[]>>(true);

accepts<Equal<ResolvedParamsOf<'segsquash'>['ids'], string[]>>(true);

accepts<Equal<ResolvedParamsOf<'segnull'>['ids'], string[] | null>>(true);

accepts<Equal<ResolvedParamsOf<'segfndefault'>['ids'], string[]>>(true);

accepts<Equal<ResolvedParamsOf<'segwidedefault'>['ids'], string | string[]>>(
  true,
);

// -- a query default of `undefined` leaves the param optional to read --------

accepts<Equal<ResolvedParamsOf<'segqueryundef'>['ids'], string | undefined>>(
  true,
);

accepts<Equal<keyof ResolvedParamsOf<'segquerydefault'>, '#' | 'ids'>>(true);

accepts<Equal<ResolvedParamsOf<'segquerydefault'>['ids'], string>>(true);

// -- a scalar path param reads the empty segment back as `''` -----------------

accepts<Equal<ResolvedParamsOf<'segscalar'>['ids[]'], string>>(true);

accepts<Equal<ResolvedParamsOf<'segscalarquery'>['ids'], string>>(true);
