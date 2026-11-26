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
  p: { path: ':id' },
  pint: { path: '{id:int}' },
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
} as const satisfies Record<string, Declared>;

type Code = keyof typeof DECLARED;

// SAFETY: the keys of a const object literal.
const CODES = Object.keys(DECLARED) as Code[];

const declared = (code: Code): Declared => DECLARED[code];

// Depth 3: a url ancestor, then a declaration the walk must look through, then the target.
const TOPS: readonly Code[] = [
  'q',
  'qtrue',
  'qint',
  'p',
  'parr',
  'cd',
  'cnone',
];

const MIDDLES: readonly Code[] = [
  'none',
  'q',
  'cd',
  'cvu',
  'cdyn',
  'carr',
  'carrd',
  'cint',
];

const LEAVES: readonly Code[] = ['q', 'qauto', 'cd', 'cvu', 'cdyn', 'cun'];

const LINEAGES: readonly (readonly Code[])[] = [
  ...CODES.flatMap((parent) => CODES.map((child) => [parent, child])),
  ...TOPS.flatMap((top) =>
    MIDDLES.flatMap((middle) => LEAVES.map((leaf) => [top, middle, leaf])),
  ),
];

const SEGMENTS = ['p', 'c', 'g'] as const;

const segment = (code: Code, level: number): string =>
  `${SEGMENTS[level]}_${code}`;

const names = (chain: readonly Code[]): string[] =>
  chain.map((_, depth) =>
    chain
      .slice(0, depth + 1)
      .map((code, level) => segment(code, level))
      .join('.'),
  );

const target = (chain: readonly Code[]): string => names(chain).at(-1) ?? '';

const urlOf = (code: Code, level: number): string => {
  const { path, query } = declared(code);

  return `/${segment(code, level)}${path ? `/${path}` : ''}${query ? `?${query}` : ''}`;
};

const declarations = (chain: readonly Code[]): StateDeclaration[] => {
  const stateNames = names(chain);

  return chain.map((code, level) => {
    const { config } = declared(code);

    const declaration: StateDeclaration = {
      name: stateNames[level],
      url: urlOf(code, level),
    };

    if (config !== undefined) declaration.params = { id: config };

    return declaration;
  });
};

const INPUTS: readonly RawParams[] = [
  {},
  { id: 'x' },
  { id: 5 },
  { id: ['a', 'b'] },
  { id: null },
];

const PATH_VALUES = ['x', '5', ''] as const;

const QUERY_VALUES = [undefined, 'id=x', 'id=5', 'id=a&id=b'] as const;

const entryUrls = (chain: readonly Code[]): string[] => {
  const hasPath = chain.some((code) => declared(code).path);
  const hasQuery = chain.some((code) => declared(code).query);

  return (hasPath ? PATH_VALUES : [undefined]).flatMap((pathValue) =>
    (hasQuery ? QUERY_VALUES : [undefined]).map((query) => {
      const path = chain
        .map(
          (code, level) =>
            `/${segment(code, level)}${declared(code).path ? `/${pathValue}` : ''}`,
        )
        .join('');

      return query ? `${path}?${query}` : path;
    }),
  );
};

const createRouter = (chain: readonly Code[]): UIRouter => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  router.stateService.defaultErrorHandler(() => undefined);

  for (const declaration of declarations(chain)) {
    router.stateRegistry.register(declaration);
  }

  return router;
};

const read = (router: UIRouter): RawParams => {
  const { '#': _hash, ...params } = router.globals.params;

  return params;
};

const go = async (
  chain: readonly Code[],
  input: RawParams,
): Promise<RawParams | undefined> => {
  const router = createRouter(chain);

  try {
    await router.stateService.go(target(chain), input);
  } catch (error) {
    if (
      error instanceof Rejection &&
      error.toString().includes('parameter values are not valid')
    ) {
      return undefined;
    }

    throw error;
  }

  return read(router);
};

const enter = async (
  chain: readonly Code[],
  url: string,
): Promise<RawParams | undefined> => {
  const router = createRouter(chain);
  router.urlService.url(url);

  if (!router.urlService.match(router.urlService.parts())) return undefined;

  const settled = new Promise<boolean>((resolve) => {
    router.transitionService.onSuccess({}, () => resolve(true));
    router.transitionService.onError({}, () => resolve(false));
  });

  router.urlService.sync();

  return (await settled) && router.globals.current.name === target(chain)
    ? read(router)
    : undefined;
};

// Core returns strings, numbers, arrays of them, `null` or `undefined` here; each is its own type literal.
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
  | { kind: 'go'; chain: readonly Code[]; input: RawParams; read: RawParams }
  | { kind: 'rejects'; chain: readonly Code[]; input: RawParams }
  | { kind: 'url'; chain: readonly Code[]; url: string; read: RawParams };

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

// `any` declarations whose input, or a default whose read-back, the registry types as `unknown`.
const WIDE_INPUT: ReadonlySet<Code> = new Set([
  'cvu',
  'cvf',
  'cun',
  'cunn',
  'cnull',
  'cnul',
]);

const WIDE_READ: ReadonlySet<Code> = new Set(['cnull', 'cnul']);

// The array mode of the declaration that decides the read-back, looking through untyped non-url ones.
const nearestMode = (chain: readonly Code[]): string | undefined => {
  for (let level = chain.length - 1; level >= 0; level -= 1) {
    const code = chain[level];
    const { path, query } = declared(code);

    if (ARRAY_CONFIG.has(code)) return 'array';

    if (query) return 'plain query';

    if (path) return 'path';

    if ((level < chain.length - 1 ? WIDE_INPUT : WIDE_READ).has(code)) {
      return 'unknown';
    }
  }

  return undefined;
};

type Divergence = {
  readonly reason: string;
  readonly matches: (testCase: Case) => boolean;
};

// Each entry is a known divergence from core; the probe fails if one stops diverging.
const DIVERGENCES: readonly Divergence[] = [
  {
    reason:
      'a query param with no array mode reads back one value, though core reads an array for an array input or a repeated key (#2472)',
    matches: (testCase) =>
      testCase.kind !== 'rejects' &&
      Array.isArray(testCase.read.id) &&
      nearestMode(testCase.chain) === 'plain query',
  },
  {
    reason:
      'a single config-only declaration with no default types as never or an array, though core reads undefined; not a redeclaration',
    matches: (testCase) =>
      testCase.kind !== 'rejects' &&
      testCase.read.id === undefined &&
      declaring(testCase.chain).length === 1 &&
      NO_DEFAULT.has(declaring(testCase.chain)[0]),
  },
];

const allowed = (testCase: Case): Divergence | undefined =>
  DIVERGENCES.find((divergence) => divergence.matches(testCase));

// A known divergence asserts the mismatch itself, so it fails once the types agree.
const assertion = (testCase: Case): string => {
  const name = `'${target(testCase.chain)}'`;
  const divergence = allowed(testCase);

  if (testCase.kind === 'rejects') {
    const check = `Rejects<${name}, ${objectType(testCase.input)}>`;

    return divergence
      ? `// ${divergence.reason}\naccepts<${check}>(false);`
      : `accepts<${check}>(true);`;
  }

  if (divergence) {
    return `// ${divergence.reason}\naccepts<Reads<${name}, ${objectType(testCase.read)}>>(false);`;
  }

  const check =
    testCase.kind === 'go'
      ? `Go<${name}, ${objectType(testCase.input)}, ${objectType(testCase.read)}>`
      : `Reads<${name}, ${objectType(testCase.read)}>`;

  return `accepts<${check}>(true);`;
};

const casesOf = async (chain: readonly Code[]): Promise<Case[]> => {
  const programmatic = await Promise.all(
    INPUTS.map(async (input): Promise<Case> => {
      const params = await go(chain, input);

      return params
        ? { kind: 'go', chain, input, read: params }
        : { kind: 'rejects', chain, input };
    }),
  );

  const entered = await Promise.all(
    entryUrls(chain).map(async (url): Promise<Case[]> => {
      const params = await enter(chain, url);

      return params ? [{ kind: 'url', chain, url, read: params }] : [];
    }),
  );

  return [...programmatic, ...entered.flat()];
};

const HEADER = `// Generated by test/lineage-differential.ts from what core returns; \`pnpm generate:lineage-differential\` rewrites it.
// \`tsc --noEmit\` is the assertion: every value core read back for an input \`ParamsOf\` takes, or for a url, fits \`ResolvedParamsOf\`.
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

type Go<N extends StateName, I, O> =
  Takes<N, I> extends true
    ? [O] extends [ResolvedParamsOf<N>]
      ? true
      : false
    : true;

type Rejects<N extends StateName, I> = Takes<N, I> extends true ? false : true;

type Reads<N extends StateName, O> = [O] extends [ResolvedParamsOf<N>]
  ? true
  : false;

declare function accepts<T>(value: T): T;
`;

const stateSource = (code: Code, level: number, name: string): string => {
  const { source } = declared(code);
  const params = source === undefined ? '' : `, params: { id: ${source} }`;

  return `{ name: '${name}', url: '${urlOf(code, level)}'${params} }`;
};

export async function generate(): Promise<string> {
  const states = new Map<string, string>();

  for (const chain of LINEAGES) {
    const stateNames = names(chain);

    chain.forEach((code, level) => {
      states.set(
        stateNames[level],
        stateSource(code, level, stateNames[level]),
      );
    });
  }

  const cases = (await Promise.all(LINEAGES.map(casesOf))).flat();

  const unused = DIVERGENCES.filter(
    (divergence) => !cases.some((testCase) => divergence.matches(testCase)),
  );

  if (unused.length > 0) {
    throw new Error(
      `divergences that match no case: ${unused.map((divergence) => divergence.reason).join('; ')}`,
    );
  }

  const text = `${HEADER}
const states = [
${[...states.values()].join(',\n')},
] as const;

declare module 'ui-router-registry' {
  interface RegisteredStates extends StatesOf<typeof states> {}
}

${[...new Set(cases.map(assertion))].join('\n\n')}
`;

  const { code, errors } = await format('probe.ts', text, OXFMT);

  if (errors.length > 0) throw new Error(errors[0].message);

  return code;
}

if (import.meta.main) writeFileSync(PROBE, await generate());
