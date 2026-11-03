/** @module url-pattern */
/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-unknown-returns -- param values are core's untyped (`any`) values */

/**
 * URLPattern routes for state `url` declarations: {@link urlPattern} declares
 * a pathname in URLPattern syntax, {@link urlPatternPlugin} matches it with
 * the platform's `URLPattern` inside a `@uirouter/core` router, and the server
 * tiers compile the same declaration translated into
 * {@link matcher | ui-router-server/matcher} syntax.
 *
 * The subset is the one both directions can serve, since URLPattern matches
 * but has no API to build a url back: literal text, `:name` groups and
 * `:name(regexp)` groups, in `pathname` only. Wildcards (`*`), unnamed or
 * `{}` groups, modifiers (`?`, `*`, `+`) and every other component are
 * rejected when declared. A group takes a regexp or a declared param `type`,
 * not both, and never a default or array mode. Query params are declared by
 * name, as ui-router's `?q&page`, and keep core's semantics.
 *
 * Experimental: names and shape may change.
 */

import type {
  BuilderFunction,
  Param,
  ParamType,
  RawParams,
  StateDeclaration,
  StateObject,
  UIRouter,
  UIRouterPlugin,
  UrlMatcher,
} from '@uirouter/core';

/** URLPattern components; every one but `pathname` must be absent or `*`. */
export interface UrlPatternComponents {
  /** The pathname pattern, in URLPattern syntax. */
  readonly pathname: string;
  /** Must be absent or `*`. */
  readonly protocol?: string;
  /** Must be absent or `*`. */
  readonly username?: string;
  /** Must be absent or `*`. */
  readonly password?: string;
  /** Must be absent or `*`. */
  readonly hostname?: string;
  /** Must be absent or `*`. */
  readonly port?: string;
  /** Must be absent or `*`; declare query params through {@link UrlPatternOptions.query}. */
  readonly search?: string;
  /** Must be absent or `*`. */
  readonly hash?: string;
}

/** Options for {@link urlPattern}. */
export interface UrlPatternOptions {
  /** Query param names, as ui-router's `?q&page`: each becomes a search param with core's types, defaults and squash. */
  readonly query?: readonly string[];
}

/** A state `url` value built by {@link urlPattern}. */
export interface UrlPatternUrl {
  /** The pathname pattern, in URLPattern syntax. */
  readonly pathname: string;
  /** The declared query param names. */
  readonly query: readonly string[];
}

type Token =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'group'; readonly name: string; readonly regexp?: string };

interface Parsed extends UrlPatternUrl {
  readonly tokens: readonly Token[];
}

const parsedUrls = new WeakMap<object, Parsed>();

const parsedOf = (url: UrlPatternUrl): Parsed => parsedUrls.get(url)!;

// ParamFactory, with the null url type core's own builder passes.
interface NullableTypeParamFactory {
  fromPath(id: string, type: ParamType | null, state: StateDeclaration): Param;
  fromSearch(
    id: string,
    type: ParamType | null,
    state: StateDeclaration,
  ): Param;
}

const OTHER_COMPONENTS = [
  'protocol',
  'username',
  'password',
  'hostname',
  'port',
  'search',
  'hash',
] as const;

const NAME = /[A-Za-z_]\w*/y;

const QUERY_NAME = /^\w+([-.]+\w+)*$/;

// Literal text the matcher syntax would read as a placeholder or search part.
const MATCHER_SPECIAL = /[:*{}?\\]/;

const closingParen = (pathname: string, open: number): number => {
  let depth = 0;

  for (let index = open; index < pathname.length; index++) {
    const char = pathname[index];

    if (char === '\\') index++;
    else if (char === '(') depth++;
    else if (char === ')' && --depth === 0) return index;
  }

  throw new Error(`URLPattern pathname '${pathname}': unclosed '('`);
};

const outsideSubset = (pathname: string, what: string, index: number): Error =>
  new Error(
    `URLPattern pathname '${pathname}': ${what} at index ${index} is outside the supported subset (literal text, :name and :name(regexp) groups)`,
  );

const parsePathname = (pathname: string): Token[] => {
  const tokens: Token[] = [];
  let text = '';
  let index = 0;

  const flush = (): void => {
    if (text) tokens.push({ kind: 'text', text });
    text = '';
  };

  while (index < pathname.length) {
    const char = pathname[index];

    if (char === '\\') {
      text += pathname[index + 1] ?? '';
      index += 2;
      continue;
    }

    if (char !== ':') {
      if ('(){}*+?'.includes(char))
        throw outsideSubset(pathname, `'${char}'`, index);
      text += char;
      index++;
      continue;
    }

    NAME.lastIndex = index + 1;
    const name = NAME.exec(pathname)?.[0];

    if (name === undefined)
      throw outsideSubset(pathname, "a ':' without a \\w name", index);
    let next = index + 1 + name.length;
    let regexp: string | undefined;

    if (pathname[next] === '(') {
      const end = closingParen(pathname, next);
      regexp = pathname.slice(next + 1, end);
      next = end + 1;
    }

    const modifier = pathname[next];

    if (modifier !== undefined && '?*+'.includes(modifier))
      throw outsideSubset(pathname, `modifier '${modifier}'`, next);
    flush();
    tokens.push({ kind: 'group', name, regexp });
    index = next;
  }

  flush();

  return tokens;
};

// oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- a state's params, as RouteDeclaration.params
type StateParams = Readonly<Record<string, unknown>>;

// A longhand declaration naming a `type`, as core's isShorthand reads it.
const declaresType = (config: unknown): boolean =>
  config instanceof Object && Object.hasOwn(config, 'type');

const isString = (value: unknown): value is string => typeof value === 'string';

const groupSpelling = (
  pathname: string,
  token: Extract<Token, { kind: 'group' }>,
  params: StateParams,
): string => {
  const typed = declaresType(params[token.name]);

  if (typed && token.regexp !== undefined)
    throw new Error(
      `URLPattern pathname '${pathname}': group ':${token.name}' takes a regexp or a declared type, not both`,
    );

  // A declared type's own pattern governs; core rejects a second inline one.
  if (typed) return `:${token.name}`;

  // URLPattern's segment wildcard is lazy: '/:name.:ext' splits 'a.b.c' at the first '.'.
  return `{${token.name}:${token.regexp === undefined ? '[^/]+?' : `(?:${token.regexp})`}}`;
};

/**
 * A {@link urlPattern} url's path in {@link matcher | ui-router-server/matcher}
 * syntax, given the declaring state's `params`.
 *
 * @internal
 */
export function matcherPath(
  url: UrlPatternUrl,
  params: StateParams = {},
): string {
  const { pathname, tokens } = parsedOf(url);

  return tokens
    .map((token) => {
      if (token.kind === 'group') return groupSpelling(pathname, token, params);

      if (MATCHER_SPECIAL.test(token.text))
        throw new Error(
          `URLPattern pathname '${pathname}': literal '${token.text}' has no matcher spelling`,
        );

      return token.text;
    })
    .join('');
}

const pathnameOf = (input: string | UrlPatternComponents): string => {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the parameter's own union: a string is the pathname
  if (typeof input === 'string') return input;

  for (const component of OTHER_COMPONENTS) {
    const value = input[component];

    if (value !== undefined && value !== '*')
      throw new Error(
        `URLPattern '${input.pathname}': component '${component}' must be absent or '*' (only pathname routes)`,
      );
  }

  return input.pathname;
};

/**
 * Declares a state `url` in URLPattern syntax. `input` is a pathname
 * pattern, a URLPattern init, or a `URLPattern` itself (its unset components
 * read `*`). Throws for anything outside the supported subset, so a pattern
 * that can't be formatted back into a url never registers.
 *
 * `StateDeclaration.url` is typed `string` in core, so the value needs a
 * cast where a state declares it.
 *
 * @example
 * ```ts
 * import { urlPattern } from 'ui-router-server/url-pattern';
 *
 * const user = { name: 'user', url: urlPattern('/users/:id(\\d+)') };
 * ```
 */
export function urlPattern(
  input: string | UrlPatternComponents,
  options: UrlPatternOptions = {},
): UrlPatternUrl {
  const pathname = pathnameOf(input);

  if (!pathname.startsWith('/'))
    throw new Error(`URLPattern pathname '${pathname}' must start with '/'`);
  const query = [...(options.query ?? [])];

  for (const name of query)
    if (!QUERY_NAME.test(name))
      throw new Error(`URLPattern '${pathname}': invalid query name '${name}'`);

  const url: UrlPatternUrl = Object.freeze({
    pathname,
    query: Object.freeze(query),
  });

  parsedUrls.set(url, { ...url, tokens: parsePathname(pathname) });
  matcherPath(url);

  return url;
}

/** True for a value {@link urlPattern} built. */
export function isUrlPatternUrl(value: unknown): value is UrlPatternUrl {
  return typeof value === 'object' && value !== null && parsedUrls.has(value);
}

interface Chain {
  readonly pathname: string;
  readonly tokens: readonly Token[];
}

interface MatcherCache {
  readonly path: readonly object[];
  readonly parent: object;
  readonly pattern: null;
  // Precomputed so core's UrlMatcher.compare never reads matcher internals.
  readonly weights: readonly number[];
}

// UrlMatcher.compare's weights: '/' 1, static text 2, a param 3.
const weightsOf = (tokens: readonly Token[]): number[] =>
  tokens.flatMap((token) =>
    token.kind === 'group'
      ? [3]
      : token.text
          .split(/(\/)/)
          .filter(Boolean)
          .map((part) => (part === '/' ? 1 : 2)),
  );

const applyReplace = (param: Param, value: unknown): unknown => {
  for (const { from, to } of param.replace) if (from === value) return to;

  return value;
};

interface Detail {
  readonly param: Param;
  readonly isValid: boolean;
  readonly isDefaultValue: boolean;
  readonly encoded: string | string[] | null | undefined;
}

const detailOf = (param: Param, values: RawParams): Detail => {
  const value: unknown = param.value(values[param.id]);

  return {
    param,
    isValid: param.validates(value),
    isDefaultValue: param.isDefaultValue(value),
    encoded: param.type.encode(value),
  };
};

// Core's query encoding: squashed defaults drop, arrays repeat the key.
const queryPart = ({ param, isDefaultValue, encoded }: Detail): string[] => {
  if (encoded == null || (isDefaultValue && param.squash !== false)) return [];
  const list = (Array.isArray(encoded) ? encoded : [encoded]).map(String);

  return list.map(
    (value) => `${param.id}=${param.raw ? value : encodeURIComponent(value)}`,
  );
};

/**
 * A duck-typed `UrlMatcher` over a URLPattern: core's `isMatcher` accepts it,
 * so it sits on a state's `url` with no fork of core. Built by
 * {@link urlPatternPlugin}'s url builder, which knows the state and its
 * parent; never construct one directly.
 *
 * @internal
 */
export class UrlPatternMatcher {
  /** The full pattern: pathname, then `?` and the query names. */
  readonly pattern: string;
  /** Core's matcher cache; `weights` is precomputed. */
  _cache: MatcherCache;
  /** The pathname and tokens from the root down, this state's included. */
  readonly chain: Chain;
  readonly #engine: URLPattern;
  readonly #own: readonly Param[];
  readonly #parent: UrlPatternMatcher | null;
  readonly #decodeParams: boolean;

  constructor(
    chain: Chain,
    own: readonly Param[],
    parent: UrlPatternMatcher | UrlMatcher,
    config: {
      readonly strict: boolean;
      readonly caseInsensitive: boolean;
      readonly decodeParams: boolean;
    },
  ) {
    this.chain = chain;
    this.#own = own;
    this.#parent = parent instanceof UrlPatternMatcher ? parent : null;
    this.#decodeParams = config.decodeParams;
    this.#engine = new URLPattern(
      { pathname: config.strict ? chain.pathname : `${chain.pathname}{/}?` },
      { ignoreCase: config.caseInsensitive },
    );

    const query = this.parameters()
      .filter((param) => param.isSearch())
      .map((param) => param.id);

    this.pattern = query.length
      ? `${chain.pathname}?${query.join('&')}`
      : chain.pathname;

    // A core parent's own path is private; the precomputed weights leave it unread.
    const parentPath =
      parent instanceof UrlPatternMatcher ? parent._cache.path : [parent];

    this._cache = {
      path: [...parentPath, this],
      parent,
      pattern: null,
      weights: weightsOf(chain.tokens),
    };
  }

  /** Throws: a string url can't extend a URLPattern url (a URLPattern child is joined by the plugin's builder). */
  append(url: UrlMatcher): UrlMatcher {
    throw new Error(
      `String url '${String(url)}' can't extend URLPattern url '${this.pattern}'; declare the child with urlPattern()`,
    );
  }

  /** Always false: a URLPattern url never belongs to the root state. */
  isRoot(): boolean {
    return false;
  }

  /** The full pattern. */
  toString(): string {
    return this.pattern;
  }

  /** Core's decoding: percent-decoding unless the type is raw, then the type's decode and default. */
  _getDecodedParamValue(value: unknown, param: Param): unknown {
    if (value === undefined) return param.value(value);
    const decode = this.#decodeParams && !param.type.raw;

    const decodeItem = (item: unknown): unknown =>
      decode && isString(item) ? decodeURIComponent(item) : item;

    const decoded = Array.isArray(value)
      ? value.map(decodeItem)
      : decodeItem(value);

    // SAFETY: core types decode's input as string; array types take the decoded list, as core passes it.
    return param.value(param.type.decode(decoded as string));
  }

  /** Matches `path` with URLPattern; search params read `search` as core's do. */
  exec(path: string, search: RawParams = {}, hash?: string): RawParams | null {
    const match = this.#engine.exec({ pathname: path });

    if (match === null) return null;
    const values: RawParams = {};

    for (const param of this.parameters()) {
      const raw = param.isSearch()
        ? applyReplace(param, search[param.id])
        : match.pathname.groups[param.id];

      values[param.id] = this._getDecodedParamValue(raw, param);
    }

    if (hash) values['#'] = hash;

    return values;
  }

  /** This url's params, or with `inherit: false` only the ones its own state declares. */
  parameters(opts: { inherit?: boolean } = {}): Param[] {
    if (opts.inherit === false || this.#parent === null) return [...this.#own];

    return [...this.#parent.parameters(), ...this.#own];
  }

  /** One param by id, searching ancestors unless `inherit: false`. */
  parameter(id: string, opts: { inherit?: boolean } = {}): Param | null {
    return (
      this.#own.find((param) => param.id === id) ??
      (opts.inherit !== false ? this.#parent?.parameter(id, opts) : null) ??
      null
    );
  }

  /** Core's check: every given value validates against its param. */
  validates(params?: RawParams | null): boolean {
    const values = params ?? {};

    return this.parameters()
      .filter((param) => Object.hasOwn(values, param.id))
      .every((param) => param.validates(values[param.id]));
  }

  /**
   * Builds the url for `values`, or null when a value is invalid or the
   * result doesn't match the pattern (a regexp group the value fails).
   */
  format(values: RawParams = {}): string | null {
    const details = new Map(
      this.parameters().map((param) => [param.id, detailOf(param, values)]),
    );

    if ([...details.values()].some((detail) => !detail.isValid)) return null;
    let path = '';

    for (const token of this.chain.tokens) {
      if (token.kind === 'text') {
        path += token.text;
        continue;
      }

      const { param, encoded } = details.get(token.name)!;

      if (!isString(encoded) || encoded === '') return null;
      path += param.raw ? encoded : encodeURIComponent(encoded);
    }

    if (this.#engine.exec({ pathname: path }) === null) return null;

    const query = [...details.values()]
      .filter((detail) => detail.param.isSearch())
      .flatMap(queryPart)
      .join('&');

    const hash = values['#'] ? `#${String(values['#'])}` : '';

    return `${path}${query ? `?${query}` : ''}${hash}`;
  }
}

// A state's url is typed UrlMatcher; the plugin's builder may have set a UrlPatternMatcher there.
const patternMatcherOf = (
  url: UrlMatcher | UrlPatternMatcher,
): UrlPatternMatcher | null => (url instanceof UrlPatternMatcher ? url : null);

const ownParams = (
  router: UIRouter,
  state: StateObject,
  parsed: Parsed,
): Param[] => {
  // Core's own url builder passes a null url type; the factory then reads the state's params config.
  const factory: NullableTypeParamFactory =
    // oxlint-disable-next-line typescript/no-deprecated -- core's only handle on its ParamFactory
    router.urlMatcherFactory.paramFactory;

  const groups = parsed.tokens.filter(
    (token): token is Extract<Token, { kind: 'group' }> =>
      token.kind === 'group',
  );

  const path = groups.map((group) =>
    factory.fromPath(group.name, null, state.self),
  );

  for (const [index, param] of path.entries()) {
    if (groups[index].regexp !== undefined && param.type.name !== 'path')
      throw new Error(
        `State '${state.name}': URLPattern group ':${param.id}' takes a regexp or a declared type, not both`,
      );

    if (param.isOptional)
      throw new Error(
        `State '${state.name}': URLPattern group ':${param.id}' is required, so it can't declare a default`,
      );

    if (param.array)
      throw new Error(
        `State '${state.name}': URLPattern group ':${param.id}' can't be an array param`,
      );
  }

  const search = parsed.query.map((name) =>
    factory.fromSearch(name, null, state.self),
  );

  return [...path, ...search];
};

const buildMatcher = (
  router: UIRouter,
  state: StateObject,
  url: UrlPatternUrl,
): UrlPatternMatcher => {
  const parsed = parsedOf(url);
  const base = (state.parent?.navigable ?? router.stateRegistry.root()).url;
  const parent = patternMatcherOf(base);

  if (parent === null && String(base) !== '')
    throw new Error(
      `State '${state.name}': URLPattern url '${url.pathname}' can't extend string url '${String(base)}'; declare the parent with urlPattern() too`,
    );

  const chain: Chain = parent
    ? {
        pathname: `${parent.chain.pathname}${parsed.pathname}`,
        tokens: [...parent.chain.tokens, ...parsed.tokens],
      }
    : parsed;

  const own = ownParams(router, state, parsed);
  const config = router.urlService.config;

  try {
    return new UrlPatternMatcher(chain, own, base, {
      strict: config.strictMode(),
      caseInsensitive: config.caseInsensitive(),
      // Core marks it internal; its own matcher factory reads the same field.
      decodeParams: config._decodeParams,
    });
  } catch (error) {
    throw new Error(
      `State '${state.name}': ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
};

// Core's own builder chain returns any; this keeps it unknown.
const builtByCore = (state: StateObject, parent?: BuilderFunction): unknown =>
  parent?.(state);

/**
 * Teaches a router's state builder {@link urlPattern} urls: a `url` built by
 * {@link urlPattern} becomes a {@link UrlPatternMatcher}, every other `url`
 * goes to core's builder. Apply it before registering states. A URLPattern
 * url extends a URLPattern parent's url or the root; a string url can't
 * extend a URLPattern one, nor the reverse.
 *
 * @example
 * ```ts
 * import { UIRouter } from '@uirouter/core';
 * import { urlPattern, urlPatternPlugin } from 'ui-router-server/url-pattern';
 *
 * const router = new UIRouter();
 * router.plugin(urlPatternPlugin);
 * router.stateRegistry.register({
 *   name: 'user',
 *   url: urlPattern('/users/:id') as unknown as string,
 * });
 * ```
 */
export function urlPatternPlugin(router: UIRouter): UIRouterPlugin {
  const builder: BuilderFunction = (state, parent) => {
    const declared: unknown = state.self.url;

    return isUrlPatternUrl(declared)
      ? buildMatcher(router, state, declared)
      : builtByCore(state, parent);
  };

  // SAFETY: decorator returns the deregistration function, typed only as Function.
  const deregister = router.stateRegistry.decorator(
    'url',
    builder,
  ) as () => void;

  return {
    name: 'urlPattern',
    dispose: () => {
      deregister();
    },
  };
}
