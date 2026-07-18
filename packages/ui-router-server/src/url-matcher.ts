// Derived from @uirouter/core (MIT, Copyright (c) 2013-2015 The AngularUI Team, Karsten Sperling) — UrlMatcher/Param/ParamTypes, https://github.com/ui-router/core

/**
 * Standalone URL path matching: compiles ui-router URL patterns
 * (`/users/:id`, `/files/*rest`, `/order/{id:int}`, `/inbox?flag`) and
 * matches pathnames with ui-router's exact semantics — but with no router
 * instance and no `$injector` (static param defaults are applied directly,
 * where upstream routes them through a service locator).
 *
 * In scope: pattern parsing, path/search placeholders, inline regexps, the
 * built-in `string`/`path`/`query`/`int`/`bool`/`date` types, strict and
 * case-insensitive modes, static defaults and squash policies, `exec`, and
 * `format` (the inverse: params in, url out, with core's squash/encode
 * semantics). Out of scope (compile errors, never silent divergence):
 * array params, `replace` configs, function (injected) defaults, and the
 * `json`/`hash`/`any` types — erroring beats compiling `{x:json}` into the
 * literal regexp /json/, which is what an unregistered name means to the
 * parser. Search params parse but never affect path matching; `exec`
 * resolves them to their static defaults.
 *
 * The public surface is type-pinned to core's signatures via type-only
 * imports (zero runtime bytes): accidental drift fails typecheck, and each
 * deliberate relaxation is a visible local derivation of the core type.
 */

import type {
  ParamDeclaration as CoreParamDeclaration,
  ParamTypeDefinition,
  RawParams,
  UrlConfig,
  UrlMatcherCompileConfig,
} from '@uirouter/core';

/**
 * The pieces of a ui-router ParamType that path matching and url formatting
 * exercise, with core's member signatures. Relaxation vs core: a plain
 * object suffices (core wants its ParamType class), `pattern` is required,
 * and `name` is carried here (the class holds it upstream). `encode` and
 * `equals`, when omitted, fall back to core's ParamType class defaults
 * (identity encode, loose equality).
 */
export interface ParamType
  extends
    Readonly<Pick<ParamTypeDefinition, 'is' | 'decode' | 'raw'>>,
    Readonly<Required<Pick<ParamTypeDefinition, 'pattern'>>> {
  readonly name: string;
  /** Relaxation vs core: may return null/undefined, which format() renders as an absent value (core's built-ins do the same at runtime). */
  readonly encode?: (val: unknown) => string | string[] | null | undefined;
  /** Relaxation vs core: optional here (core's class always carries one). */
  readonly equals?: ParamTypeDefinition['equals'];
}

const { freeze } = Object;

// Core's makeDefaultType encode: stringly, null/undefined passed through.
const valToString = (val: unknown): string | null | undefined =>
  val === null || val === undefined
    ? val
    : (val as number | string | boolean).toString();

// Core's ParamType class defaults, for custom types that omit the members.
const typeEncode = (
  type: ParamType,
  val: unknown,
): string | string[] | null | undefined =>
  type.encode ? type.encode(val) : (val as string | null | undefined);
const typeEquals = (type: ParamType, a: unknown, b: unknown): boolean =>
  // eslint-disable-next-line eqeqeq -- core's default equals coerces (null/undefined/'' and string/number pairs compare loosely)
  type.equals ? type.equals(a, b) : a == b;

const stringBase = {
  is: (val: unknown): boolean => typeof val === 'string',
  // Stringly, like core's makeDefaultType: format()/validates() normalize
  // non-string inputs (numbers, booleans) through decode, not just url text.
  decode: valToString,
  encode: valToString,
};

const decodeInt = (val: string) => parseInt(val, 10);
const dateCapture = /([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])/;
const isDate = (val: unknown): val is Date =>
  val instanceof Date && !Number.isNaN(val.valueOf());

/**
 * The ui-router built-in types, minus json/hash/any (rejected at compile).
 * Frozen: every compiled matcher shares these singletons.
 */
const builtinTypes: Record<string, ParamType> = {
  string: freeze({ ...stringBase, name: 'string', pattern: /.*/ }),
  path: freeze({ ...stringBase, name: 'path', pattern: /[^/]*/ }),
  query: freeze({ ...stringBase, name: 'query', pattern: /.*/ }),
  int: freeze({
    name: 'int',
    pattern: /-?\d+/,
    // Only a number can strict-equal parseInt of its own string form.
    is: (val: unknown) =>
      typeof val === 'number' && decodeInt(val.toString()) === val,
    decode: decodeInt,
    encode: valToString,
  }),
  bool: freeze({
    name: 'bool',
    pattern: /0|1/,
    is: (val: unknown) => typeof val === 'boolean',
    decode: (val: string) => decodeInt(val) !== 0,
    // Truthiness, as upstream ((val && 1) || 0) — undefined encodes to '0'.
    encode: (val: unknown) => (val ? '1' : '0'),
  }),
  date: freeze({
    name: 'date',
    pattern: /[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[1-2][0-9]|3[0-1])/,
    is: isDate,
    decode: (val: string) => {
      const match = dateCapture.exec(val);
      return match ? new Date(+match[1], +match[2] - 1, +match[3]) : undefined;
    },
    encode: (val: unknown) =>
      isDate(val)
        ? [
            val.getFullYear(),
            `0${val.getMonth() + 1}`.slice(-2),
            `0${val.getDate()}`.slice(-2),
          ].join('-')
        : undefined,
    // Calendar-day equality, as upstream: throws on non-dates, core does too.
    equals: (l: unknown, r: unknown) =>
      (['getFullYear', 'getMonth', 'getDate'] as const).every(
        (fn) => (l as Date)[fn]() === (r as Date)[fn](),
      ),
  }),
};

// Upstream registers these, but they only mean something with url building
// or search-value handling; rejected at compile (see the module docblock).
const unsupportedTypes = new Set(['hash', 'json', 'any']);

/**
 * A per-param configuration: core's ParamDeclaration members that matching
 * honors. Relaxation vs core: `type` also accepts a plain-object
 * [[ParamType]], and `value` must be static (functions are rejected).
 */
export interface ParamDeclaration extends Pick<
  CoreParamDeclaration,
  'value' | 'squash'
> {
  /** Type for params not already typed inline (`{id:int}`) — a built-in name or a [[ParamType]]. */
  type?: string | ParamType;
}

// Keys that mark a declaration as longhand (ui-router's isShorthand set);
// anything else — including objects — is treated as a shorthand default value.
const declarationKeys = ['value', 'type', 'squash', 'array', 'dynamic'];

interface FullDeclaration
  extends ParamDeclaration, Pick<CoreParamDeclaration, 'array' | 'replace'> {}

const unwrapShorthand = (config: unknown): FullDeclaration =>
  config !== null &&
  typeof config === 'object' &&
  declarationKeys.some((key) => Object.hasOwn(config, key))
    ? config
    : { value: config };

const resolveType = (
  declared: string | ParamType | undefined,
  urlType: ParamType | null,
  isSearch: boolean,
  id: string,
): ParamType => {
  if (declared && urlType && urlType.name !== 'string')
    throw new Error(`Param '${id}' has two type configurations.`);
  if (typeof declared === 'string' && unsupportedTypes.has(declared))
    throw new Error(
      `Param type '${declared}' is not supported by the standalone matcher`,
    );
  if (typeof declared === 'string' && urlType && builtinTypes[declared])
    return builtinTypes[declared];
  if (urlType) return urlType;
  if (!declared) return builtinTypes[isSearch ? 'query' : 'path'];
  if (typeof declared === 'object') return declared;
  const named = builtinTypes[declared] as ParamType | undefined;
  if (!named)
    throw new Error(
      `Unknown type '${declared}' for param '${id}'; built-in types: ${Object.keys(builtinTypes).join(', ')}`,
    );
  return named;
};

// An inline '{name:...}' body: a built-in type name, or a raw regexp that
// adopts the positional default type's semantics.
const resolveInlineType = (
  inline: string,
  isSearch: boolean,
  caseInsensitive: boolean,
): ParamType => {
  if (unsupportedTypes.has(inline))
    throw new Error(
      `Param type '${inline}' is not supported by the standalone matcher`,
    );
  return (
    builtinTypes[inline] ?? {
      ...builtinTypes[isSearch ? 'query' : 'path'],
      pattern: new RegExp(inline, caseInsensitive ? 'i' : undefined),
    }
  );
};

/** false, true, or the placeholder string: the param's url squash policy. */
const getSquashPolicy = (
  declared: unknown,
  isOptional: boolean,
  defaultPolicy: boolean | string,
): boolean | string => {
  if (!isOptional || declared === false) return false;
  if (declared === undefined || declared === null) return defaultPolicy;
  if (declared === true || typeof declared === 'string') return declared;
  throw new Error(
    `Invalid squash policy: '${JSON.stringify(declared)}'. Valid policies: false, true, or arbitrary string`,
  );
};

/** An input rewrite applied before typing (absent/empty/squash handling). */
export interface Replace {
  from: unknown;
  to: unknown;
}

// Empty/absent matches map to undefined for optional params (triggering the
// default), '' otherwise; a string squash placeholder also means "absent".
const getReplace = (
  isOptional: boolean,
  squash: boolean | string,
): Replace[] => {
  const fromSquash: Replace[] =
    typeof squash === 'string' ? [{ from: squash, to: undefined }] : [];
  const defaults: Replace[] = [
    { from: '', to: isOptional ? undefined : '' },
    { from: null, to: isOptional ? undefined : '' },
  ].filter((item) => !fromSquash.some((r) => r.from === item.from));
  return [...defaults, ...fromSquash];
};

/** A compiled parameter: inert data for one placeholder of a pattern. */
export interface CompiledParam {
  readonly id: string;
  readonly type: ParamType;
  readonly isSearch: boolean;
  readonly isOptional: boolean;
  readonly squash: boolean | string;
  readonly replace: readonly Replace[];
  /** The static default value, applied directly (see the module docblock). */
  readonly defaultValue: unknown;
}

const compileParam = (
  id: string,
  urlType: ParamType | null,
  isSearch: boolean,
  config: ResolvedConfig,
  pattern: string,
): CompiledParam => {
  const declared = unwrapShorthand(config.params[id]);
  const where = `param '${id}' in pattern '${pattern}'`;
  if (id.endsWith('[]') || (Object.hasOwn(declared, 'array') && declared.array))
    throw new Error(
      `Array parameters are not supported by the standalone matcher (${where})`,
    );
  if (Object.hasOwn(declared, 'replace'))
    throw new Error(
      `'replace' is not supported by the standalone matcher (${where})`,
    );
  if (typeof declared.value === 'function')
    throw new Error(
      `Function (injected) defaults are not supported by the standalone matcher (${where}); use a static value`,
    );

  const isOptional = declared.value !== undefined || isSearch;
  const squash = getSquashPolicy(
    declared.squash,
    isOptional,
    config.defaultSquashPolicy,
  );
  return freeze<CompiledParam>({
    id,
    type: resolveType(declared.type, urlType, isSearch, id),
    isSearch,
    isOptional,
    squash,
    replace: freeze(getReplace(isOptional, squash)),
    defaultValue: declared.value,
  });
};

/** The typed value for a decoded input, or the static default when absent (core's Param.value). */
const paramValue = (param: CompiledParam, input: unknown): unknown => {
  for (const { from, to } of param.replace) {
    if (from === input) {
      input = to;
      break;
    }
  }
  if (input === undefined) {
    // Static value, applied directly: upstream invokes even non-function
    // defaults through services.$injector and throws when none exists.
    const value = param.defaultValue;
    if (value !== null && value !== undefined && !param.type.is(value))
      throw new Error(
        `Default value (${JSON.stringify(value)}) for parameter '${param.id}' is not an instance of ParamType (${param.type.name})`,
      );
    return value;
  }
  return param.type.is(input) ? input : param.type.decode(input as string);
};

/** True when the typed value equals the param's default (core's Param.isDefaultValue). */
const paramIsDefault = (param: CompiledParam, input: unknown): boolean => {
  if (!param.isOptional) return false;
  const defaultValue = paramValue(param, undefined);
  // Search params are auto-array-wrapped upstream, where an absent value
  // compares as the empty array: equal only to another absent value.
  if (param.isSearch && (defaultValue === undefined || input === undefined))
    return defaultValue === undefined && input === undefined;
  return typeEquals(param.type, defaultValue, input);
};

/** Whether a typed value can appear in a built url (core's Param.validates). */
const paramValidates = (param: CompiledParam, input: unknown): boolean => {
  // No value, but the param is optional.
  if ((input === undefined || input === null) && param.isOptional) return true;
  const normalized: unknown = param.type.is(input)
    ? input
    : param.type.decode(input as string);
  if (!param.type.is(normalized)) return false;
  // Of the right type, but its encoded form escapes the type's pattern.
  const encoded = typeEncode(param.type, normalized);
  return !(typeof encoded === 'string' && !param.type.pattern.exec(encoded));
};

/** Escapes a static segment; with a param, appends its capture group per squash policy. */
const quoteRegExp = (segment: string, param?: CompiledParam): string => {
  let result = segment.replace(/[\\[\]^$*+?.()|{}]/g, '\\$&');
  if (!param) return result;
  let surround: [string, string];
  switch (param.squash) {
    case false:
      surround = ['(', param.isOptional ? ')?' : ')'];
      break;
    case true:
      result = result.replace(/\/$/, '');
      surround = ['(?:/(', ')|/)?'];
      break;
    default:
      surround = [`(${param.squash}|`, ')?'];
      break;
  }
  return result + surround[0] + param.type.pattern.source + surround[1];
};

export interface UrlMatcherCompileOptions<M = undefined> extends Pick<
  UrlMatcherCompileConfig,
  'strict' | 'caseInsensitive'
> {
  /** Relaxation vs core: `state.params` flattened to `params` (no StateDeclaration here) — a [[ParamDeclaration]] or a shorthand static default per name. */
  params?: Record<string, unknown>;
  /** Passenger field: rides the compiled matcher as [[CompiledMatcher.meta]], untouched by compilation. */
  meta?: M;
}

export interface UrlMatcherCompilerConfig extends Pick<
  UrlMatcherCompileConfig,
  'strict' | 'caseInsensitive' | 'decodeParams'
> {
  /** Squash policy for defaulted params that don't declare one (default false); value type pinned to core's UrlConfig.defaultSquashPolicy. */
  defaultSquashPolicy?: NonNullable<
    Parameters<UrlConfig['defaultSquashPolicy']>[0]
  >;
}

interface ResolvedConfig extends Required<UrlMatcherCompilerConfig> {
  params: Record<string, unknown>;
}

/**
 * A compiled url pattern: inert data produced by [[urlMatcherFactory]]'s
 * `compile` and consumed by [[exec]], [[format]], and [[compare]].
 * Frozen — treat as immutable: [[compare]] memoizes per object identity,
 * and the functions/regexps inside make it not structuredClone-able.
 * Two data channels: compile's `options.meta` rides compile-time data on
 * the matcher, and a consumer-owned identity-keyed WeakMap (frozen keys
 * are fine) covers external or mutable association.
 */
export interface CompiledMatcher<M = undefined> {
  /** The pattern that was compiled. */
  readonly pattern: string;
  /** The whole-path regexp the pattern compiled to. */
  readonly regexp: RegExp;
  /** The raw static segments between path params (length: path params + 1). */
  readonly segments: readonly string[];
  readonly pathParams: readonly CompiledParam[];
  readonly searchParams: readonly CompiledParam[];
  /** Whether [[exec]] percent-decodes captured values (the factory's decodeParams). */
  readonly decodeParams: boolean;
  /** Compile-time data riding the matcher (e.g. a build-time route id); the reference is frozen in, the object stays consumer-owned. */
  readonly meta: M;
}

const nameValidator = /^\w+([-.]+\w+)*(?:\[\])?$/;

const compileMatcher = <M>(
  pattern: string,
  config: ResolvedConfig,
  meta: M,
): CompiledMatcher<M> => {
  // Placeholder syntax (regexps identical to @uirouter/core): ':name',
  // '*name' (catch-all), '{name}', '{name:regexp-or-type}' with balanced or
  // escaped inner braces; search params additionally allow '.' and '-' in
  // names. The (?=(\s*))\4 backreference makes the regexp-body atom atomic.
  const placeholder =
    /([:*])([\w[\]]+)|\{([\w[\]]+)(?::(?=(\s*))\4((?:[^{}\\]|\\.|\{(?:[^{}\\]|\\.)*\})+))?\}/g;
  const searchPlaceholder =
    /([:]?)([\w[\].-]+)|\{([\w[\].-]+)(?::(?=(\s*))\4((?:[^{}\\]|\\.|\{(?:[^{}\\]|\\.)*\})+))?\}/g;

  const params: CompiledParam[] = [];
  const compiled: string[] = [];
  const segments: string[] = [];

  const paramFromMatch = (
    m: RegExpExecArray,
    isSearch: boolean,
  ): CompiledParam => {
    const id = m[2] || m[3];
    // Inline regexp or type name from '{name:...}'; '*name' matches everything.
    const inline = isSearch
      ? m[5]
      : m[5] || (m[1] === '*' ? '[\\s\\S]*' : null);
    if (!nameValidator.test(id))
      throw new Error(`Invalid parameter name '${id}' in pattern '${pattern}'`);
    if (params.some((p) => p.id === id))
      throw new Error(
        `Duplicate parameter name '${id}' in pattern '${pattern}'`,
      );
    const urlType = inline
      ? resolveInlineType(inline, isSearch, config.caseInsensitive)
      : null;
    return compileParam(id, urlType, isSearch, config, pattern);
  };

  // Split the path part into static segments separated by param placeholders.
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = placeholder.exec(pattern)) !== null) {
    const segment = pattern.substring(last, match.index);
    if (segment.includes('?')) break; // we're into the search part
    const param = paramFromMatch(match, false);
    params.push(param);
    compiled.push(quoteRegExp(segment, param));
    segments.push(segment);
    last = placeholder.lastIndex;
  }
  let segment = pattern.substring(last);

  // Search params live after '?'; they parse (and must be valid) but never
  // affect whether a path matches.
  const searchIndex = segment.indexOf('?');
  if (searchIndex >= 0) {
    const search = segment.substring(searchIndex + 1);
    segment = segment.substring(0, searchIndex);
    while ((match = searchPlaceholder.exec(search)) !== null) {
      params.push(paramFromMatch(match, true));
    }
  }
  compiled.push(quoteRegExp(segment));
  segments.push(segment);

  return freeze({
    pattern,
    regexp: new RegExp(
      `^${compiled.join('')}${config.strict ? '' : '/?'}$`,
      config.caseInsensitive ? 'i' : undefined,
    ),
    segments: freeze(segments),
    pathParams: freeze(params.filter((param) => !param.isSearch)),
    searchParams: freeze(params.filter((param) => param.isSearch)),
    decodeParams: config.decodeParams,
    meta,
  });
};

// Core's sort weights: slash → 1, static text → 2, param → 3; search
// params carry no weight. Memoized as in core; the WeakMap keeps the
// cache off the matcher's inert data.
const weightsCache = new WeakMap<CompiledMatcher<unknown>, number[]>();

const segmentWeights = (matcher: CompiledMatcher<unknown>): number[] => {
  const cached = weightsCache.get(matcher);
  if (cached) return cached;
  const weights: number[] = [];
  matcher.segments.forEach((segment, index) => {
    for (const piece of segment.split(/(\/)/)) {
      if (piece === '') continue;
      weights.push(piece === '/' ? 1 : 2);
    }
    if (matcher.pathParams[index]) weights.push(3);
  });
  weightsCache.set(matcher, weights);
  return weights;
};

/**
 * Sorts two compiled matchers by static specificity, as core's
 * UrlMatcher.compare: path tokens compared position-by-position, slash
 * before static text before a param. Negative means `a` is more specific
 * than `b`. Single-matcher only: matchers here never `append`.
 */
export function compare(
  a: CompiledMatcher<unknown>,
  b: CompiledMatcher<unknown>,
): number {
  const weightsA = segmentWeights(a);
  const weightsB = segmentWeights(b);
  const length = Math.max(weightsA.length, weightsB.length);
  for (let i = 0; i < length; i++) {
    const cmp = (weightsA[i] ?? 0) - (weightsB[i] ?? 0);
    if (cmp !== 0) return cmp;
  }
  return 0;
}

/**
 * Tests a url path against a compiled matcher.
 *
 * Returns the captured parameter values when the path matches the pattern,
 * or null when it does not. Search params always appear in the result,
 * resolved to their static defaults (undefined when none is declared).
 */
export function exec(
  matcher: CompiledMatcher<unknown>,
  path: string,
): RawParams | null {
  const match = matcher.regexp.exec(path);
  if (!match) return null;
  // A custom inline regexp with its own capture group would misalign values.
  if (match.length - 1 !== matcher.pathParams.length)
    throw new Error(`Unbalanced capture group in route '${matcher.pattern}'`);

  const values: RawParams = {};
  matcher.pathParams.forEach((param, index) => {
    let value: unknown = match[index + 1];
    for (const { from, to } of param.replace) {
      if (from === value) value = to;
    }
    if (value !== undefined) {
      const raw =
        matcher.decodeParams && !param.type.raw
          ? decodeURIComponent(value as string)
          : (value as string);
      value = param.type.decode(raw);
    }
    values[param.id] = paramValue(param, value);
  });
  for (const param of matcher.searchParams) {
    values[param.id] = paramValue(param, undefined);
  }
  return values;
}

/**
 * Builds a url from a compiled matcher by substituting parameter values —
 * the inverse of [[exec]], mirroring core's UrlMatcher.format for the
 * supported subset (no parent-matcher composition: matchers here never
 * append). Default values honor the squash policy, search params render
 * as a query string, and `values['#']` appends a hash fragment.
 *
 * Returns null when any value fails its param's validation.
 */
export function format(
  matcher: CompiledMatcher<unknown>,
  values: RawParams = {},
): string | null {
  const details = (param: CompiledParam) => {
    const value = paramValue(param, values[param.id]);
    const isValid = paramValidates(param, value);
    const isDefaultValue = paramIsDefault(param, value);
    // Squashing only ever applies to a param sitting at its default.
    const squash = isDefaultValue ? param.squash : false;
    // Auto-array wrapping again: an absent search value encodes to
    // undefined (the empty array unwraps), skipping the scalar encoder.
    const encoded =
      param.isSearch && value === undefined
        ? undefined
        : typeEncode(param.type, value);
    return { param, isValid, isDefaultValue, squash, encoded };
  };
  const path = matcher.pathParams.map(details);
  const search = matcher.searchParams.map(details);
  if ([...path, ...search].some((d) => !d.isValid)) return null;

  let result = '';
  matcher.segments.forEach((segment, index) => {
    result += segment;
    const detail = path[index];
    if (!detail) return; // the final segment has no param after it
    const { squash, encoded, param } = detail;
    if (squash === true) {
      if (result.endsWith('/')) result = result.slice(0, -1);
      return;
    }
    if (typeof squash === 'string') {
      result += squash;
      return;
    }
    if (encoded === null || encoded === undefined) return;
    result += param.type.raw
      ? String(encoded)
      : encodeURIComponent(encoded as string);
  });

  const query = search
    .map(({ param, squash, encoded, isDefaultValue }) => {
      if (
        encoded === null ||
        encoded === undefined ||
        (isDefaultValue && squash !== false)
      )
        return null;
      const vals = Array.isArray(encoded) ? encoded : [encoded];
      if (vals.length === 0) return null;
      return vals
        .map(
          (val) =>
            `${param.id}=${param.type.raw ? val : encodeURIComponent(val)}`,
        )
        .join('&');
    })
    .filter((pair) => pair !== null)
    .join('&');

  const fragment = values['#'] ? `#${String(values['#'])}` : '';
  return result + (query ? `?${query}` : '') + fragment;
}

/**
 * Creates a matcher compiler — named for core's UrlMatcherFactory, whose
 * defaults it keeps: strict trailing-slash matching, case-sensitive,
 * percent-decoding on, and a default squash policy of false.
 */
export function urlMatcherFactory(config: UrlMatcherCompilerConfig = {}): {
  compile: <M = undefined>(
    pattern: string,
    options?: UrlMatcherCompileOptions<M>,
  ) => CompiledMatcher<M>;
} {
  const {
    strict = true,
    caseInsensitive = false,
    decodeParams = true,
    defaultSquashPolicy = false,
  } = config;
  // Same validation as ui-router's UrlConfig.defaultSquashPolicy().
  getSquashPolicy(defaultSquashPolicy, true, false);
  return {
    compile: <M = undefined>(
      pattern: string,
      options: UrlMatcherCompileOptions<M> = {},
    ) =>
      compileMatcher(
        pattern,
        {
          strict: options.strict ?? strict,
          caseInsensitive: options.caseInsensitive ?? caseInsensitive,
          decodeParams,
          defaultSquashPolicy,
          params: options.params ?? {},
        },
        // Omitted meta is the declared default: `compile(p)` → meta undefined.
        options.meta as M,
      ),
  };
}
