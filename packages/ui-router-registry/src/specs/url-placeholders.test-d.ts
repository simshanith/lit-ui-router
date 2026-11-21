// Url placeholders read as core 6.1's `UrlMatcher` reads them. `tsc --noEmit`
// is the assertion; nothing runs this file.
import type {
  ParamsOf,
  ResolvedParamsOf,
  StateName,
  StatesOf,
  TypedStateService,
} from '../index.js';

const urlStates = [
  { name: 'files', url: '/files/*path' },
  { name: 'doc', url: '/doc/:docId.json' },
  { name: 'item', url: '/item-:itemId' },
  { name: 'range', url: '/range/{from}-{to}' },
  { name: 'raw', url: '/raw/{rest:[^/]*}' },
  { name: 'spaced', url: '/spaced/{n: int}' },
  { name: 'trailing', url: '/trailing/{n:int }' },
  { name: 'optional', url: '/opt/{code:[a-z]?}?sort' },
  { name: 'nested', url: '/zip/{zip:[0-9]{5}}' },
  { name: 'escaped', url: '/esc/{tag:\\}x}' },
  { name: 'colon', url: '/time/10:-/:slot' },
  { name: 'digits', url: '/time/10:30' },
  { name: 'emptybody', url: '/x/{bad:}/:y' },
  { name: 'openbrace', url: '/x/{a{b}' },
  { name: 'colonquery', url: '/list?:page&size' },
  { name: 'dotquery', url: '/q?{a.b:int}&{c-d: int}&{e.f}&{g:}' },
  {
    name: 'long',
    url: '/a/:p0/b/:p1/c/:p2/d/:p3/e/:p4/f/:p5/g/:p6/h/:p7/i/:p8/j/:p9/k/{p10:int}/l/{p11:[0-9]+}/m/:p12.json/n/*p13?q0&q1&{q2:int}',
  },
] as const;

declare module '../index.js' {
  interface RegisteredStates extends StatesOf<typeof urlStates> {}
}

declare const stateService: TypedStateService;

declare function accepts<T>(value: T): T;

type Keys<N extends StateName> = Exclude<keyof ParamsOf<N>, '#'>;

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// -- a placeholder that shares a segment or holds a slash ----------------------

void stateService.go('files', { path: 'a/b' });

// @ts-expect-error a catch-all param is required
void stateService.go('files');

void stateService.go('doc', { docId: 'x' });

void stateService.go('item', { itemId: 'x' });

void stateService.go('range', { from: 'a', to: 'b' });

// @ts-expect-error both placeholders in one segment are required
void stateService.go('range', { from: 'a' });

void stateService.go('raw', { rest: 'x' });

accepts<Equal<Keys<'files'>, 'path'>>(true);

accepts<Equal<Keys<'doc'>, 'docId'>>(true);

accepts<Equal<Keys<'item'>, 'itemId'>>(true);

accepts<Equal<Keys<'range'>, 'from' | 'to'>>(true);

accepts<Equal<Keys<'raw'>, 'rest'>>(true);

// -- a `{name:type}` body -----------------------------------------------------

void stateService.go('spaced', { n: 1 });

// @ts-expect-error whitespace after the colon is skipped, so `{n: int}` is an int
void stateService.go('spaced', { n: '1' });

// Trailing whitespace stays in the body, so core reads `int ` as a regex.
accepts<ResolvedParamsOf<'trailing'>['n']>('1');

// A `?` inside a regex body doesn't start the query.
accepts<Equal<Keys<'optional'>, 'code' | 'sort'>>(true);

void stateService.go('optional', { code: 'a' });

// A body may hold one level of braces.
accepts<Equal<Keys<'nested'>, 'zip'>>(true);

// An escaped brace doesn't close the body.
accepts<Equal<Keys<'escaped'>, 'tag'>>(true);

// A colon before a non-word character is literal text.
accepts<Equal<Keys<'colon'>, 'slot'>>(true);

// A name may start with a digit.
accepts<Equal<Keys<'digits'>, '30'>>(true);

// A brace that opens no placeholder is literal text.
accepts<Equal<Keys<'emptybody'>, 'y'>>(true);

accepts<Equal<Keys<'openbrace'>, 'b'>>(true);

// -- query placeholders -------------------------------------------------------

accepts<Equal<Keys<'colonquery'>, 'page' | 'size'>>(true);

void stateService.go('colonquery');

// A query name may hold `.` or `-`, and an empty body keeps the name.
accepts<Equal<Keys<'dotquery'>, 'a.b' | 'c-d' | 'e.f' | 'g'>>(true);

accepts<ResolvedParamsOf<'dotquery'>['c-d']>(1);

// -- a long url ---------------------------------------------------------------

accepts<
  Equal<
    Keys<'long'>,
    | `p${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13}`
    | 'q0'
    | 'q1'
    | 'q2'
  >
>(true);

accepts<ResolvedParamsOf<'long'>['p10']>(1);

accepts<ResolvedParamsOf<'long'>['q2']>(1);
