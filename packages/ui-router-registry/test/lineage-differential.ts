// Runs generated lineages through core and emits one type assertion per value core returned.
import { writeFileSync } from 'node:fs';

import {
  memoryLocationPlugin,
  Rejection,
  servicesPlugin,
  UIRouter,
} from '@uirouter/core';
import type { RawParams, StateDeclaration } from '@uirouter/core';
import { format } from 'oxfmt';

export const PROBE = new URL(
  '../test-d/lineage-differential/lineage-differential.test-d.ts',
  import.meta.url,
);

// The root `.oxfmtrc.json`; `format:check` fails the probe if the two drift.
const OXFMT = { singleQuote: true, printWidth: 80 } as const;

type Declared = {
  readonly path?: string;
  readonly query?: string;
  // `params.id` at runtime, and as the probe spells it
  readonly config?:
    | string
    | {
        readonly array?: boolean | 'auto';
        readonly dynamic?: boolean;
        readonly squash?: boolean;
        readonly type?: string;
        readonly value?:
          | string
          | null
          | (() => string | number | undefined | null);
      };
  readonly source?: string;
};

const DECLARED = {
  none: {},
  q: { query: 'id' },
  qd: { query: 'id', config: 'd', source: "'d'" },
  qauto: {
    query: 'id',
    config: { array: 'auto' },
    source: "{ array: 'auto' }",
  },
  qtrue: { query: 'id', config: { array: true }, source: '{ array: true }' },
  qfalse: {
    query: 'id',
    config: { array: false },
    source: '{ array: false }',
  },
  qint: { query: '{id:int}' },
  qbool: { query: '{id:bool}' },
  p: { path: ':id' },
  pint: { path: '{id:int}' },
  pbool: { path: '{id:bool}' },
  parr: { path: ':id', config: { array: true }, source: '{ array: true }' },
  cnone: { config: { squash: true }, source: '{ squash: true }' },
  cd: { config: 'd', source: "'d'" },
  cnull: { config: { value: null }, source: '{ value: null }' },
  cvu: { config: { value: undefined }, source: '{ value: undefined }' },
  cvf: {
    config: { value: () => undefined },
    source: '{ value: () => undefined }',
  },
  cdyn: { config: { dynamic: true }, source: '{ dynamic: true }' },
  carr: { config: { array: true }, source: '{ array: true }' },
  carrd: {
    config: { array: true, value: 'd' },
    source: "{ array: true, value: 'd' }",
  },
  cint: { config: { type: 'int' }, source: "{ type: 'int' }" },
  cun: {
    config: { value: (): string | undefined => 'd' },
    source: "{ value: (): string | undefined => 'd' }",
  },
  cunn: {
    config: { value: (): number | undefined => 5 },
    source: '{ value: (): number | undefined => 5 }',
  },
  cnul: {
    config: { value: (): string | null => 'd' },
    source: "{ value: (): string | null => 'd' }",
  },
  pbad: { path: '{id:int}', config: 'bad', source: "'bad'" },
  qbad: { query: '{id:int}', config: 'bad', source: "'bad'" },
  cbad: {
    config: { type: 'int', value: 'bad' },
    source: "{ type: 'int', value: 'bad' }",
  },
} as const satisfies Record<string, Declared>;

type Code = keyof typeof DECLARED;

// SAFETY: the keys of a const object literal.
const CODES = Object.keys(DECLARED) as Code[];

const declared = (code: Code): Declared => DECLARED[code];

// A default its own declaration rejects; alone it hits the single-state gap, so it is only ever a redeclaring child.
const BAD_DEFAULT: ReadonlySet<Code> = new Set(['pbad', 'qbad', 'cbad']);

const TYPED_CONFIG: ReadonlySet<Code> = new Set(['cint', 'cbad']);

// Depth 3: an ancestor, then a declaration the walk must look through, then the target.
const TOPS: readonly Code[] = [
  'q',
  'qtrue',
  'qauto',
  'qint',
  'p',
  'parr',
  'cd',
  'cnone',
  'cvu',
];

const MIDDLES: readonly Code[] = [
  'none',
  'q',
  'p',
  'pint',
  'pbool',
  'parr',
  'cd',
  'cvu',
  'cvf',
  'cdyn',
  'carr',
  'carrd',
  'cint',
];

const LEAVES: readonly Code[] = [
  'q',
  'qauto',
  'cd',
  'cvu',
  'cvf',
  'cdyn',
  'cun',
];

const QUERY_TOPS: readonly Code[] = ['q', 'qtrue', 'qint', 'qbool'];

// Depth 4: a query above a path, then a second pass-through; a silent state there reads as depth 3.
const DEEP: readonly (readonly Code[])[] = QUERY_TOPS.flatMap((top) =>
  (['p', 'pint', 'pbool'] as const).flatMap((path) =>
    (['cdyn', 'cd', 'cvf'] as const).map((leaf) => [top, path, 'cdyn', leaf]),
  ),
);

// Children that name their parent with `parent:`.
const BY_PARENT: readonly (readonly Code[])[] = QUERY_TOPS.flatMap((top) =>
  (['p', 'pint', 'parr', 'cvf'] as const).flatMap((middle) =>
    (['cdyn', 'cd'] as const).map((leaf) => [top, middle, leaf]),
  ),
);

type Lineage = { readonly chain: readonly Code[]; readonly byParent: boolean };

const LINEAGES: readonly Lineage[] = [
  ...[
    ...CODES.filter((parent) => !BAD_DEFAULT.has(parent)).flatMap((parent) =>
      CODES.filter(
        (child) => !(BAD_DEFAULT.has(child) && parent === 'none'),
      ).map((child) => [parent, child]),
    ),
    ...TOPS.flatMap((top) =>
      MIDDLES.flatMap((middle) => LEAVES.map((leaf) => [top, middle, leaf])),
    ),
    ...DEEP,
  ].map((chain) => ({ chain, byParent: false })),
  ...BY_PARENT.map((chain) => ({ chain, byParent: true })),
];

// Siblings differ in code, so a code alone names each level and its url segment.
const segment = (code: Code): string => code;

// A `parent:` lineage spells each state's whole path without a dot.
const names = ({ chain, byParent }: Lineage): string[] =>
  chain.map((_, depth) => {
    const path = chain.slice(0, depth + 1).map((code) => segment(code));

    return byParent ? `r_${path.join('_')}` : path.join('.');
  });

const target = (lineage: Lineage): string => names(lineage).at(-1) ?? '';

const urlOf = (code: Code): string => {
  const { path, query } = declared(code);

  return `/${segment(code)}${path ? `/${path}` : ''}${query ? `?${query}` : ''}`;
};

const declarations = (lineage: Lineage): StateDeclaration[] => {
  const stateNames = names(lineage);

  return lineage.chain.map((code, level) => {
    const { config } = declared(code);

    const declaration: StateDeclaration = {
      name: stateNames[level],
      url: urlOf(code),
    };

    if (lineage.byParent && level > 0) {
      declaration.parent = stateNames[level - 1];
    }

    if (config !== undefined) declaration.params = { id: config };

    return declaration;
  });
};

// What each input or default holds, so the model of `ParamsOf` needs no runtime check.
type Kind = 'absent' | 'string' | 'number' | 'boolean' | 'strings' | 'null';

type Input = { readonly params: RawParams; readonly kind: Kind };

const INPUTS: readonly Input[] = [
  { params: {}, kind: 'absent' },
  { params: { id: 'x' }, kind: 'string' },
  { params: { id: 5 }, kind: 'number' },
  { params: { id: true }, kind: 'boolean' },
  { params: { id: ['a', 'b'] }, kind: 'strings' },
  { params: { id: null }, kind: 'null' },
];

// `transitionTo` doesn't wrap a scalar default on an array param, as `go` does.
const METHODS = ['go', 'transitionTo'] as const;

const PATH_VALUES = ['x', '5', '1', ''] as const;

const QUERY_VALUES = [undefined, 'id=x', 'id=5', 'id=0', 'id=a&id=b'] as const;

const entryUrls = (chain: readonly Code[]): string[] => {
  const hasPath = chain.some((code) => declared(code).path);
  const hasQuery = chain.some((code) => declared(code).query);

  return (hasPath ? PATH_VALUES : [undefined]).flatMap((pathValue) =>
    (hasQuery ? QUERY_VALUES : [undefined]).map((query) => {
      const path = chain
        .map(
          (code) =>
            `/${segment(code)}${declared(code).path ? `/${pathValue}` : ''}`,
        )
        .join('');

      return query ? `${path}?${query}` : path;
    }),
  );
};

const createRouter = (lineage: Lineage): UIRouter => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  router.stateService.defaultErrorHandler(() => undefined);

  for (const declaration of declarations(lineage)) {
    router.stateRegistry.register(declaration);
  }

  return router;
};

const read = (router: UIRouter): RawParams => {
  const { '#': _hash, ...params } = router.globals.params;

  return params;
};

// Core throws, rather than rejects, when it reaches a default its own type rejects.
const BAD_DEFAULT_ERROR =
  /^Default value \(.*\) for parameter 'id' is not an instance of ParamType/;

const navigate = async (
  lineage: Lineage,
  input: RawParams,
  method: (typeof METHODS)[number],
): Promise<RawParams | undefined> => {
  const router = createRouter(lineage);

  try {
    await router.stateService[method](target(lineage), input);
  } catch (error) {
    if (
      (error instanceof Rejection &&
        error.toString().includes('parameter values are not valid')) ||
      (error instanceof Error && BAD_DEFAULT_ERROR.test(error.message))
    ) {
      return undefined;
    }

    throw error;
  }

  return read(router);
};

type Entered =
  | { readonly outcome: 'read'; readonly read: RawParams }
  | { readonly outcome: 'no match' | 'not entered' };

const entered = async (lineage: Lineage, url: string): Promise<Entered> => {
  const router = createRouter(lineage);
  router.urlService.url(url);

  if (!router.urlService.match(router.urlService.parts())) {
    return { outcome: 'no match' };
  }

  const settled = new Promise<boolean>((resolve) => {
    router.transitionService.onSuccess({}, () => resolve(true));
    router.transitionService.onError({}, () => resolve(false));
  });

  router.urlService.sync();

  return (await settled) && router.globals.current.name === target(lineage)
    ? { outcome: 'read', read: read(router) }
    : { outcome: 'not entered' };
};

const enter = async (lineage: Lineage, url: string): Promise<Entered> => {
  try {
    return await entered(lineage, url);
  } catch (error) {
    if (error instanceof Error && BAD_DEFAULT_ERROR.test(error.message)) {
      return { outcome: 'not entered' };
    }

    throw error;
  }
};

// Core returns strings, numbers, booleans, arrays of them, `null` or `undefined` here; each is its own type literal.
const objectType = (params: RawParams): string =>
  Object.keys(params).length === 0
    ? 'Record<never, never>'
    : `{ ${Object.entries(params)
        .map(
          ([key, value]) =>
            `${key}: ${value === undefined ? 'undefined' : JSON.stringify(value)}`,
        )
        .join('; ')} }`;

type Case =
  | { kind: 'go'; lineage: Lineage; input: Input; read: RawParams }
  | { kind: 'rejects'; lineage: Lineage; input: Input }
  | { kind: 'url'; lineage: Lineage; url: string; read: RawParams };

const declaring = (chain: readonly Code[]): Code[] =>
  chain.filter((code) => code !== 'none');

const ARRAY_CONFIG: ReadonlySet<Code> = new Set([
  'qauto',
  'qtrue',
  'qfalse',
  'parr',
  'carr',
  'carrd',
]);

const NO_DEFAULT: ReadonlySet<Code> = new Set(['cnone', 'cdyn', 'carr']);

// The target's own declaration decides its read-back unless it is untyped and non-url.
const ownMode = (code: Code): string | undefined => {
  const { path, query } = declared(code);

  if (ARRAY_CONFIG.has(code)) return 'array';

  if (query) return 'plain query';

  if (path) return 'path';

  return TYPED_CONFIG.has(code) ? 'typed' : undefined;
};

// A pass-through reads the nearest query declaration's decoding, or an array a path one below it took when that query takes an array.
const nearestMode = (chain: readonly Code[]): string | undefined => {
  const own = ownMode(chain[chain.length - 1]);

  if (own) return own;

  let path: string | undefined;

  for (const code of chain.slice(0, -1).reverse()) {
    const mode = ownMode(code);

    if (declared(code).query) {
      return path === 'array' && TAKES[code].has('strings') ? path : mode;
    }

    if (declared(code).path) path ??= mode;
  }

  return path;
};

type Divergence = {
  readonly tag: string;
  readonly reason: string;
  readonly matches: (testCase: Case) => boolean;
};

// Each entry is a known divergence from core; the probe fails if one stops diverging.
const DIVERGENCES: readonly Divergence[] = [
  {
    tag: 'plain-query',
    reason:
      'a query param with no array mode reads back one value, though core reads an array for an array input or a repeated key (#2472)',
    matches: (testCase) =>
      testCase.kind !== 'rejects' &&
      Array.isArray(testCase.read.id) &&
      nearestMode(testCase.lineage.chain) === 'plain query',
  },
  {
    tag: 'config-only',
    reason:
      'a single config-only declaration with no default types as never or an array, though core reads undefined; not a redeclaration',
    matches: (testCase) =>
      testCase.kind !== 'rejects' &&
      testCase.read.id === undefined &&
      declaring(testCase.lineage.chain).length === 1 &&
      NO_DEFAULT.has(declaring(testCase.lineage.chain)[0]),
  },
];

type GoCase = Extract<Case, { kind: 'go' }>;

const STRING: ReadonlySet<Kind> = new Set(['string']);

const STRINGS: ReadonlySet<Kind> = new Set(['string', 'strings']);

const NUMBER: ReadonlySet<Kind> = new Set(['number']);

const BOOLEAN: ReadonlySet<Kind> = new Set(['boolean']);

const ANY: ReadonlySet<Kind> = new Set([
  'string',
  'number',
  'boolean',
  'strings',
  'null',
]);

const NONE: ReadonlySet<Kind> = new Set();

// What `ParamsOf` takes for each declaration: its own type, or its default's widened one when untyped and non-url.
const TAKES: Readonly<Record<Code, ReadonlySet<Kind>>> = {
  none: ANY,
  q: STRINGS,
  qd: STRINGS,
  qauto: STRINGS,
  qtrue: STRINGS,
  qfalse: STRING,
  qint: NUMBER,
  qbool: BOOLEAN,
  p: STRING,
  pint: NUMBER,
  pbool: BOOLEAN,
  parr: STRINGS,
  cnone: NONE,
  cd: STRING,
  cnull: ANY,
  cvu: ANY,
  cvf: ANY,
  cdyn: NONE,
  carr: ANY,
  carrd: STRINGS,
  cint: NUMBER,
  cun: ANY,
  cunn: ANY,
  cnul: ANY,
  pbad: NUMBER,
  qbad: NUMBER,
  cbad: NUMBER,
};

// What each default can return.
const DEFAULTS: Partial<Record<Code, readonly Kind[]>> = {
  qd: ['string'],
  cd: ['string'],
  cnull: ['null'],
  cvu: ['absent'],
  cvf: ['absent'],
  carrd: ['string'],
  cun: ['string', 'absent'],
  cunn: ['number', 'absent'],
  cnul: ['string', 'null'],
  pbad: ['string'],
  qbad: ['string'],
  cbad: ['string'],
};

const isPassThrough = (code: Code): boolean => {
  const { path, query } = declared(code);

  return !path && !query && !TYPED_CONFIG.has(code);
};

const optionalAlone = (code: Code): boolean =>
  DEFAULTS[code] !== undefined || Boolean(declared(code).query);

// A pass-through takes any value; another declaration takes an absent or `null` one only when optional alone.
const acceptsDefault = (code: Code, kind: Kind): boolean =>
  isPassThrough(code) ||
  (kind === 'absent' || kind === 'null'
    ? optionalAlone(code)
    : TAKES[code].has(kind));

// Only the nearest declaration's default fills the key, and every declaration checks each value it can return.
const optional = (chain: readonly Code[]): boolean => {
  const levels = declaring(chain);
  const nearest = levels[levels.length - 1];

  if (levels.length === 1) return optionalAlone(nearest);

  return (DEFAULTS[nearest] ?? ['absent']).every((kind) =>
    levels.every((code) => acceptsDefault(code, kind)),
  );
};

// The first declaration takes its own type; a later pass-through takes whatever the ones above it take.
const failing = (chain: readonly Code[], kind: Kind): Code[] =>
  declaring(chain).filter(
    (code, index) =>
      !(index > 0 && isPassThrough(code)) && !TAKES[code].has(kind),
  );

// An undeclared key is an excess property.
const typesTake = ({ lineage, input }: GoCase): boolean => {
  if (input.kind === 'absent') return optional(lineage.chain);

  return (
    declaring(lineage.chain).length > 0 &&
    failing(lineage.chain, input.kind).length === 0
  );
};

const BOOL: ReadonlySet<Code> = new Set(['qbool', 'pbool']);

const NEVER: ReadonlySet<Code> = new Set(['cnone', 'cdyn']);

type OverStrict = {
  readonly tag: string;
  readonly reason: string;
  readonly matches: (testCase: GoCase) => boolean;
};

// The declarations that reject an input: for an absent one, those that reject a value the nearest default can return.
const rejecting = ({ lineage, input }: GoCase): Code[] => {
  if (input.kind !== 'absent') return failing(lineage.chain, input.kind);

  const levels = declaring(lineage.chain);
  const nearest = levels[levels.length - 1];

  if (levels.length === 1) return optionalAlone(nearest) ? [] : [nearest];

  const kinds = DEFAULTS[nearest] ?? ['absent'];

  return levels.filter((code) =>
    kinds.some((kind) => !acceptsDefault(code, kind)),
  );
};

const fails = (testCase: GoCase, codes: ReadonlySet<Code>): boolean =>
  rejecting(testCase).some((code) => codes.has(code));

const EMPTY_ARRAY: ReadonlySet<Code> = new Set(['parr', 'carr']);

// Inputs core takes that `ParamsOf` rejects, each for a stated reason; the first that matches names it.
const OVER_STRICT: readonly OverStrict[] = [
  {
    tag: 'undeclared',
    reason:
      'core ignores a param no state declares; `ParamsOf` rejects it as an excess property',
    matches: ({ lineage }) => declaring(lineage.chain).length === 0,
  },
  {
    tag: 'bool',
    reason:
      "core's bool type decodes any value, and validates an absent one on a path param; the registry takes a boolean",
    matches: (testCase) => fails(testCase, BOOL),
  },
  {
    tag: 'no-default',
    reason:
      'a config-only declaration with no default types as never on input, though core takes a value or none (single-state type)',
    matches: (testCase) => fails(testCase, NEVER),
  },
  {
    tag: 'null',
    reason:
      'core takes null for an optional or string param; the registry types null only as a `value: null` default',
    matches: ({ input }) => input.kind === 'null',
  },
  {
    tag: 'coercion',
    reason:
      'core coerces before it validates (a string param takes a number, a boolean or an array, an int one a numeric string); the registry types no coercion',
    matches: ({ input }) => input.kind !== 'absent',
  },
  {
    tag: 'empty-array',
    reason:
      'an array path param that matches an empty segment, or a config-only `array: true` one, takes an absent value in core; the registry requires it',
    matches: (testCase) =>
      testCase.input.kind === 'absent' && fails(testCase, EMPTY_ARRAY),
  },
  {
    tag: 'default-union',
    reason:
      'a default function typed to return undefined or null, or a number under a string parent, fills the key in core; the registry checks every member of its declared type',
    matches: ({ lineage }) =>
      ['cun', 'cunn', 'cnul'].includes(declaring(lineage.chain).at(-1) ?? ''),
  },
];

const reasonFor = (testCase: GoCase): OverStrict => {
  const entry = OVER_STRICT.find((candidate) => candidate.matches(testCase));

  if (!entry) {
    throw new Error(
      `no over-strict reason for ${target(testCase.lineage)} ${JSON.stringify(testCase.input.params)}`,
    );
  }

  return entry;
};

const allowed = (testCase: Case): Divergence | undefined =>
  DIVERGENCES.find((divergence) => divergence.matches(testCase));

const overStrict = (testCase: Case): OverStrict | undefined =>
  testCase.kind === 'go' && !typesTake(testCase)
    ? reasonFor(testCase)
    : undefined;

const takeCheck = (name: string, testCase: GoCase, entry: OverStrict): string =>
  `accepts<Takes<${name}, ${objectType(testCase.input.params)}>>(false); // ${entry.tag}`;

// A known divergence asserts the mismatch itself, so it fails once the types agree.
const assertion = (testCase: Case): string => {
  const name = `'${target(testCase.lineage)}'`;

  if (testCase.kind === 'rejects') {
    return `accepts<Rejects<${name}, ${objectType(testCase.input.params)}>>(true);`;
  }

  const strict = overStrict(testCase);

  if (strict && testCase.kind === 'go') {
    return takeCheck(name, testCase, strict);
  }

  const check =
    testCase.kind === 'go'
      ? `Go<${name}, ${objectType(testCase.input.params)}, ${objectType(testCase.read)}>`
      : `Reads<${name}, ${objectType(testCase.read)}>`;

  const divergence = allowed(testCase);

  return divergence
    ? `accepts<${check}>(false); // ${divergence.tag}`
    : `accepts<${check}>(true);`;
};

// An untyped root with no literal default reads back unknown even alone; under any other root the read-back is known.
const UNCONSTRAINED: ReadonlySet<Code> = new Set([
  'cnone',
  'cdyn',
  'cvu',
  'cvf',
  'cnull',
  'carr',
  'cun',
  'cunn',
  'cnul',
]);

const known = (lineage: Lineage): string[] => {
  const root = declaring(lineage.chain)[0];

  return root === undefined || UNCONSTRAINED.has(root)
    ? []
    : [`accepts<Known<'${target(lineage)}'>>(true);`];
};

type Tally = { urls: number; noMatch: number; notEntered: number };

const programmatic = async (lineage: Lineage): Promise<Case[]> =>
  (
    await Promise.all(
      INPUTS.flatMap((input) =>
        METHODS.map(async (method): Promise<Case> => {
          const params = await navigate(lineage, input.params, method);

          return params
            ? { kind: 'go', lineage, input, read: params }
            : { kind: 'rejects', lineage, input };
        }),
      ),
    )
  ).flat();

const casesOf = async (lineage: Lineage, tally: Tally): Promise<Case[]> => {
  const urls = entryUrls(lineage.chain);
  const entered = await Promise.all(urls.map((url) => enter(lineage, url)));

  tally.urls += urls.length;
  tally.noMatch += entered.filter(
    (result) => result.outcome === 'no match',
  ).length;
  tally.notEntered += entered.filter(
    (result) => result.outcome === 'not entered',
  ).length;

  return [
    ...(await programmatic(lineage)),
    ...entered.flatMap((result, index): Case[] =>
      result.outcome === 'read'
        ? [{ kind: 'url', lineage, url: urls[index], read: result.read }]
        : [],
    ),
  ];
};

const HEADER = `// Generated by test/lineage-differential.ts from what core returns; \`pnpm generate:lineage-differential\` rewrites it.
// \`tsc --noEmit\` is the assertion: \`ParamsOf\` takes every input core takes, and \`ResolvedParamsOf\` admits what core reads back, as a known type under a root that constrains it, unless an allowlisted entry says why not.
import type {
  ParamsOf,
  ResolvedParamsOf,
  StateName,
  StatesOf,
} from 'ui-router-registry';

type Takes<N extends StateName, I> = [I] extends [ParamsOf<N>]
  ? [Exclude<keyof I, keyof ParamsOf<N>>] extends [never]
    ? true
    : false
  : false;

type Reads<N extends StateName, O> = [O] extends [ResolvedParamsOf<N>]
  ? true
  : false;

type Go<N extends StateName, I, O> =
  Takes<N, I> extends true ? Reads<N, O> : 'not taken';

type Rejects<N extends StateName, I> = Takes<N, I> extends true ? false : true;

type Known<N extends StateName> =
  ResolvedParamsOf<N> extends { id?: infer V }
    ? unknown extends V
      ? false
      : true
    : true;

declare function accepts<T>(value: T): T;
`;

const stateSource = (
  lineage: Lineage,
  level: number,
  stateNames: readonly string[],
): string => {
  const code = lineage.chain[level];
  const { source } = declared(code);

  const parent =
    lineage.byParent && level > 0 ? `, parent: '${stateNames[level - 1]}'` : '';

  const params = source === undefined ? '' : `, params: { id: ${source} }`;

  return `{ name: '${stateNames[level]}'${parent}, url: '${urlOf(code)}'${params} }`;
};

const count = (assertions: readonly string[], pattern: string): number =>
  assertions.filter((text) => text.includes(pattern)).length;

const summary = (
  states: number,
  tally: Tally,
  assertions: readonly string[],
): string =>
  [
    `// ${LINEAGES.length} lineages, ${states} states; ${tally.urls} urls tried, ${tally.noMatch} unmatched, ${tally.notEntered} ending elsewhere or in an error.`,
    `// ${assertions.length} assertions: ${count(assertions, 'accepts<Go<')} go, ${count(assertions, 'accepts<Reads<')} url, ${count(assertions, 'accepts<Rejects<')} rejections, ${count(assertions, 'accepts<Takes<')} over-strict inputs, ${count(assertions, 'accepts<Known<')} known read-backs, ${count(assertions, '>(false); //') - count(assertions, 'accepts<Takes<')} allowlisted read-backs.`,
    ...[...OVER_STRICT, ...DIVERGENCES].map(
      (entry) =>
        `//   ${entry.tag} (${count(assertions, `>(false); // ${entry.tag}`)}): ${entry.reason}`,
    ),
  ].join('\n');

export async function generate(): Promise<string> {
  const states = new Map<string, string>();

  for (const lineage of LINEAGES) {
    const stateNames = names(lineage);

    lineage.chain.forEach((_, level) => {
      states.set(stateNames[level], stateSource(lineage, level, stateNames));
    });
  }

  const tally: Tally = { urls: 0, noMatch: 0, notEntered: 0 };

  const cases = (
    await Promise.all(LINEAGES.map((lineage) => casesOf(lineage, tally)))
  ).flat();

  const unused = [...DIVERGENCES, ...OVER_STRICT].filter(
    (entry) =>
      !cases.some(
        (testCase) =>
          allowed(testCase) === entry || overStrict(testCase) === entry,
      ),
  );

  if (unused.length > 0) {
    throw new Error(
      `allowlist entries that match no case: ${unused.map((entry) => entry.reason).join('; ')}`,
    );
  }

  const assertions = [
    ...new Set([...cases.map(assertion), ...LINEAGES.flatMap(known)]),
  ];

  const text = `${HEADER}
${summary(states.size, tally, assertions)}
const states = [
${[...states.values()].join(',\n')},
] as const;

declare module 'ui-router-registry' {
  interface RegisteredStates extends StatesOf<typeof states> {}
}

${assertions.join('\n\n')}
`;

  const { code, errors } = await format('probe.ts', text, OXFMT);

  if (errors.length > 0) throw new Error(errors[0].message);

  return code;
}

if (import.meta.main) writeFileSync(PROBE, await generate());
