/** @module url-pattern/client */
/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-unknown-returns -- param values are core's untyped (`any`) values */

/**
 * The client half of URLPattern urls: {@link urlPatternPlugin} teaches a
 * `@uirouter/core` router to match
 * {@link url-pattern!urlPattern | urlPattern} urls with the platform's
 * `URLPattern`. It carries no server code; the server strategies take the
 * compiler in `ui-router-server/url-pattern/server`.
 *
 * Node 22 and older browsers need `urlpattern-polyfill` loaded first;
 * registering a URLPattern state without a global `URLPattern` throws.
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

import { parsedUrlPattern, requireUrlPattern } from './url-pattern.ts';
import type { ParsedUrlPattern, UrlPatternToken } from './url-pattern.ts';

type Token = UrlPatternToken;

type Parsed = ParsedUrlPattern;

const isString = (value: unknown): value is string => typeof value === 'string';

// ParamFactory, with the null url type core's own builder passes.
interface NullableTypeParamFactory {
  fromPath(id: string, type: ParamType | null, state: StateDeclaration): Param;
  fromSearch(
    id: string,
    type: ParamType | null,
    state: StateDeclaration,
  ): Param;
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

type Groups = Record<string, string | undefined>;

const escapeChar = (char: string): string => encodeURIComponent(char);

const decodeOrNull = (value: string): string | null => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
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
    requireUrlPattern();
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

  /**
   * Matches `path` with URLPattern; search params read `search` as core's do.
   * With `decodeParams` off (`@uirouter/angularjs`), `path` arrives
   * decoded: it matches in the engine's encoding and its groups decode back.
   */
  exec(path: string, search: RawParams = {}, hash?: string): RawParams | null {
    const groups = this.#decodeParams
      ? this.#encodedGroups(path)
      : this.#decodedGroups(path);

    if (groups === null) return null;
    const values: RawParams = {};

    for (const param of this.parameters()) {
      const raw = param.isSearch()
        ? applyReplace(param, search[param.id])
        : groups[param.id];

      values[param.id] = this._getDecodedParamValue(raw, param);
    }

    if (hash) values['#'] = hash;

    return values;
  }

  #encodedGroups(path: string): Groups | null {
    const match = this.#engine.exec({ pathname: path });

    // The engine rewrites a non-canonical path before matching; a string url never does.
    return match === null || match.pathname.input !== path
      ? null
      : match.pathname.groups;
  }

  #decodedGroups(path: string): Groups | null {
    const match = this.#engine.exec({
      pathname: path.replace(/[%?#]/g, escapeChar),
    });

    // Canonical only if the engine just percent-encoded: decoding its input gives `path` back.
    if (match === null || decodeOrNull(match.pathname.input) !== path)
      return null;
    const groups: Groups = {};

    for (const [id, value] of Object.entries(match.pathname.groups)) {
      const decoded = value === undefined ? undefined : decodeOrNull(value);

      // A regexp group that ends inside an escape can't spell a decoded value.
      if (decoded === null) return null;
      groups[id] = decoded;
    }

    return groups;
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

    // The engine's own spelling of the path, so exec accepts what format builds.
    const canonical = this.#engine.exec({ pathname: path })?.pathname.input;

    if (canonical === undefined) return null;

    const query = [...details.values()]
      .filter((detail) => detail.param.isSearch())
      .flatMap(queryPart)
      .join('&');

    const hash = values['#'] ? `#${String(values['#'])}` : '';

    return `${canonical}${query ? `?${query}` : ''}${hash}`;
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
  parsed: Parsed,
): UrlPatternMatcher => {
  const base = (state.parent?.navigable ?? router.stateRegistry.root()).url;
  const parent = patternMatcherOf(base);

  if (parent === null && String(base) !== '')
    throw new Error(
      `State '${state.name}': URLPattern url '${parsed.pathname}' can't extend string url '${String(base)}'; declare the parent with urlPattern() too`,
    );

  const chain: Chain = parent
    ? {
        pathname: `${parent.chain.pathname}${parsed.pathname}`,
        tokens: [...parent.chain.tokens, ...parsed.tokens],
      }
    : parsed;

  const own = ownParams(router, state, parsed);
  const inherited = new Set(parent?.parameters().map((param) => param.id));
  const repeated = own.find((param) => inherited.has(param.id));

  if (repeated)
    throw new Error(
      `State '${state.name}': duplicate parameter name '${repeated.id}' in URLPattern url '${chain.pathname}'`,
    );
  const config = router.urlService.config;

  try {
    return new UrlPatternMatcher(chain, own, base, {
      strict: config.strictMode(),
      caseInsensitive: config.caseInsensitive(),
      // Core marks it internal; its own matcher factory reads the same field.
      decodeParams: config._decodeParams,
    });
  } catch (error) {
    // SAFETY: requireUrlPattern and the URLPattern constructor throw only Errors.
    throw new Error(`State '${state.name}': ${(error as Error).message}`, {
      cause: error,
    });
  }
};

// Core's own builder chain returns any; this keeps it unknown.
const builtByCore = (state: StateObject, parent?: BuilderFunction): unknown =>
  parent?.(state);

// Core's getPlugin keeps a disposed plugin; this holds only live ones.
const applied = new WeakMap<UIRouter, UIRouterPlugin>();

/**
 * Teaches a router's state builder {@link url-pattern!urlPattern | urlPattern} urls: a `url` built by
 * `urlPattern()` becomes a duck-typed `UrlMatcher`, every other `url`
 * goes to core's builder. Apply it before registering states, and before
 * {@link url-config!applyUrlConfig | applyUrlConfig} so a trailing-slash
 * policy formats these urls too. Applying it again to the same router
 * returns the plugin already applied. A URLPattern
 * url extends a URLPattern parent's url or the root; a string url can't
 * extend a URLPattern one, nor the reverse.
 *
 * @example
 * ```ts
 * import { UIRouter } from '@uirouter/core';
 * import { urlPattern } from 'ui-router-server/url-pattern';
 * import { urlPatternPlugin } from 'ui-router-server/url-pattern/client';
 *
 * const router = new UIRouter();
 * router.plugin(urlPatternPlugin);
 * router.stateRegistry.register({
 *   name: 'user',
 *   url: urlPattern('/users/:id'),
 * });
 * ```
 */
export function urlPatternPlugin(router: UIRouter): UIRouterPlugin {
  const live = applied.get(router);

  // A second decorator would wrap the first; a repeat application hands back the live plugin.
  if (live) return live;

  const builder: BuilderFunction = (state, parent) => {
    const parsed = parsedUrlPattern(state.self.url);

    return parsed
      ? buildMatcher(router, state, parsed)
      : builtByCore(state, parent);
  };

  // SAFETY: decorator returns the deregistration function, typed only as Function.
  const deregister = router.stateRegistry.decorator(
    'url',
    builder,
  ) as () => void;

  const plugin: UIRouterPlugin = {
    name: 'urlPattern',
    dispose: () => {
      deregister();

      if (applied.get(router) === plugin) applied.delete(router);
    },
  };

  applied.set(router, plugin);

  return plugin;
}
