/** @module url-pattern */

/**
 * URLPattern urls for state `url` declarations, as plain data:
 * {@link urlPattern} declares a pathname in URLPattern syntax and
 * {@link urlPatternOf} reads the declaration back. This entry holds no
 * matching code. A client router matches the declaration with the plugin in
 * `ui-router-server/url-pattern/client`, and the server strategies with the
 * compiler in `ui-router-server/url-pattern/server`; both run the platform's
 * `URLPattern`.
 *
 * The subset is the one both directions can serve, since URLPattern matches
 * but has no API to build a url back: literal text, `:name` groups and
 * `:name(regexp)` groups, in `pathname` only. Wildcards (`*`), unnamed or
 * `{}` groups, modifiers (`?`, `*`, `+`) and every other component are
 * rejected when declared. A group takes a regexp or a declared param `type`,
 * not both, and never a default or array mode. Query params are declared by
 * name, as ui-router's `?q&page`, and keep core's semantics.
 *
 * Runtimes: Node 24, deno, workerd and current browsers ship `URLPattern`.
 * Node 22 and older browsers need `urlpattern-polyfill` loaded first;
 * compiling a URLPattern state without a global `URLPattern` throws.
 *
 * Experimental: names and shape may change.
 */

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

declare const urlPatternBrand: unique symbol;

/**
 * A state `url` value built by {@link urlPattern}. Branded `string` so it
 * fits core's string-typed `StateDeclaration.url`, but at runtime it is a
 * frozen declaration object, never a string: read it with
 * {@link urlPatternOf}, not string methods.
 */
export type UrlPatternUrl = string & {
  /** Marks a {@link urlPattern} value; never present at runtime. */
  readonly [urlPatternBrand]: true;
};

/** What a {@link urlPattern} url declares, as {@link urlPatternOf} reads it. */
export interface UrlPatternDeclaration {
  /** The pathname pattern, in URLPattern syntax. */
  readonly pathname: string;
  /** The declared query param names. */
  readonly query: readonly string[];
}

/**
 * One piece of a parsed pathname: literal text, or a named group.
 *
 * @internal
 */
export type UrlPatternToken =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'group'; readonly name: string; readonly regexp?: string };

/**
 * A {@link urlPattern} declaration with its parsed pathname.
 *
 * @internal
 */
export interface ParsedUrlPattern extends UrlPatternDeclaration {
  /** The pathname's tokens, in order. */
  readonly tokens: readonly UrlPatternToken[];
}

const parsedUrls = new WeakMap<object, ParsedUrlPattern>();

/**
 * The parsed declaration behind a {@link urlPattern} url, or undefined for
 * any other value (a string url included).
 *
 * @internal
 */
export const parsedUrlPattern = (
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- any state url value; identity decides
  value: unknown,
): ParsedUrlPattern | undefined =>
  value instanceof Object ? parsedUrls.get(value) : undefined;

/**
 * Throws unless the runtime has a global `URLPattern`, naming the polyfill.
 *
 * @internal
 */
export function requireUrlPattern(): void {
  if (!('URLPattern' in globalThis))
    throw new Error(
      "URLPattern routes need a global URLPattern, which this runtime lacks (node < 23.8, older browsers); load 'urlpattern-polyfill' before compiling them",
    );
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

// The group at `index` (a ':'), and the index after it.
const parseGroup = (
  pathname: string,
  index: number,
): [group: UrlPatternToken, next: number] => {
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

  return [{ kind: 'group', name, regexp }, next];
};

const parsePathname = (pathname: string): UrlPatternToken[] => {
  const tokens: UrlPatternToken[] = [];
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

    const [group, next] = parseGroup(pathname, index);
    flush();
    tokens.push(group);
    index = next;
  }

  flush();

  return tokens;
};

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
 * that can't be formatted back into a url never registers. The result is a
 * {@link UrlPatternUrl}, so it sits on a state's `url` with no cast.
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

  const declaration: UrlPatternDeclaration = Object.freeze({
    pathname,
    query: Object.freeze(query),
  });

  parsedUrls.set(declaration, {
    ...declaration,
    tokens: parsePathname(pathname),
  });

  // SAFETY: the runtime value is the frozen declaration object, not a string; urlPatternOf and the url builders read it back.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- the brand's one cast, keeping declaration sites cast-free
  return declaration as unknown as UrlPatternUrl;
}

/**
 * What a {@link urlPattern} url declares, or null for any other value (a
 * string url included).
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- any state url value; identity decides
export function urlPatternOf(value: unknown): UrlPatternDeclaration | null {
  const parsed = parsedUrlPattern(value);

  return parsed ? { pathname: parsed.pathname, query: parsed.query } : null;
}
