/**
 * A segment-trie route matcher over {@link compileRoutes} output: the
 * pathname's `/`-separated segments walk a trie to the few routes whose
 * spelling fits, and {@link matchRoute} runs on just those. Exec still decides
 * every match, so params, `compare` tie-breaking, and thrown errors are
 * exactly what {@link matchRoute} gives over the same routes.
 *
 * A route is expressible when its pattern's `/`s are all static. Routes that
 * aren't come back as {@link InexpressibleRoute}s and the trie never matches
 * them.
 */

import { matchRoute } from './redirects.ts';
import type { CompiledRoute, RouteIndex, RouteMatch } from './redirects.ts';

/**
 * Why a route stays out of the trie: its compiler was `caseInsensitive`, or
 * a path param's pattern (or squash string) may consume a `/`.
 */
export type InexpressibleReason = 'case-insensitive' | 'slash-spanning-param';

/** A route the trie can't express, with the reason. */
export interface InexpressibleRoute {
  /** The route as {@link compileRoutes} compiled it. */
  readonly route: CompiledRoute;
  /** Why it stays out of the trie. */
  readonly reason: InexpressibleReason;
  /** The offending path param, for `slash-spanning-param`. */
  readonly param?: string;
}

/** A compiled trie: {@link matchRoute} over its expressible routes, pruned by segment. */
export interface RouteTrie {
  /** Same result as {@link matchRoute} over the expressible routes. */
  readonly match: (pathname: string) => RouteMatch | null;
  /** The routes left out, in declaration order. */
  readonly inexpressible: readonly InexpressibleRoute[];
}

interface TrieNode {
  readonly literal: Map<string, TrieNode>;
  param: TrieNode | null;
  readonly routes: number[];
}

/** One url segment of a route spelling: literal text, or `null` for a segment holding a param. */
type Segment = string | null;

const node = (): TrieNode => ({ literal: new Map(), param: null, routes: [] });

// An escape, a character class, or one source character.
const atom =
  /\\(?:x[\da-fA-F]{2}|u[\da-fA-F]{4}|c[a-zA-Z]|[\s\S])|\[(?:\\[\s\S]|[^\\\]])*\]|[\s\S]/g;

// Numeric escapes are backreferences or legacy octals (\057 is '/'): refuse them unread.
const opaqueEscape = /^\\[\dk]/;

const atomMatchesSlash = (token: string): boolean => {
  if (token.length === 1) return token === '/' || token === '.';

  if (opaqueEscape.test(token)) return true;

  return new RegExp(`^(?:${token})$`).test('/');
};

/** True when a regexp source may consume a `/` or close a group it didn't open; never a false negative. */
const mayMatchSlash = (source: string): boolean => {
  let depth = 0;

  for (const token of source.match(atom) ?? []) {
    if (token === '(') depth++;

    if (token === ')') depth--;

    if (depth < 0 || atomMatchesSlash(token)) return true;
  }

  return depth !== 0;
};

const slashSpanningParam = (route: CompiledRoute): string | undefined =>
  route.matcher.pathParams.find(
    ({ type, squash }) =>
      mayMatchSlash(type.pattern.source) ||
      (squash !== true && squash !== false && mayMatchSlash(squash)),
  )?.id;

const classify = (route: CompiledRoute): InexpressibleRoute | null => {
  if (route.matcher.regexp.flags.includes('i'))
    return { route, reason: 'case-insensitive' };
  const param = slashSpanningParam(route);

  return param === undefined
    ? null
    : { route, reason: 'slash-spanning-param', param };
};

const appendText = (spelling: Segment[], text: string): Segment[] => {
  const [head, ...rest] = text.split('/');
  const last = spelling[spelling.length - 1];

  return [
    ...spelling.slice(0, -1),
    last === null ? null : last + head,
    ...rest,
  ];
};

const appendParam = (spelling: Segment[]): Segment[] => [
  ...spelling.slice(0, -1),
  null,
];

/**
 * Every segment sequence a route's regexp can match: a squash-true param is
 * `(?:/(p)|/)?` after its segment's trailing `/`, so it forks the spelling.
 */
const spellingsOf = ({ matcher }: CompiledRoute): Segment[][] => {
  let spellings: Segment[][] = [['']];

  matcher.segments.forEach((text, index) => {
    const param = matcher.pathParams[index];

    if (param?.squash !== true) {
      spellings = spellings.map((spelling) => appendText(spelling, text));

      if (param) spellings = spellings.map(appendParam);

      return;
    }

    const stripped = text.replace(/\/$/, '');
    spellings = spellings.flatMap((spelling) => {
      const absent = appendText(spelling, stripped);

      return [absent, appendParam(appendText(absent, '/'))];
    });
  });

  // compile() appends `/?` only when not strict; quoted static text escapes `?`.
  if (matcher.regexp.source.endsWith('\\/?$'))
    spellings = [
      ...spellings,
      ...spellings.map((spelling) => appendText(spelling, '/')),
    ];

  return spellings;
};

const insert = (root: TrieNode, spelling: Segment[], index: number): void => {
  let current = root;

  for (const segment of spelling) {
    if (segment === null) {
      current.param ??= node();
      current = current.param;
      continue;
    }

    let next = current.literal.get(segment);

    if (!next) {
      next = node();
      current.literal.set(segment, next);
    }

    current = next;
  }

  if (!current.routes.includes(index)) current.routes.push(index);
};

const collect = (
  current: TrieNode,
  segments: string[],
  depth: number,
  found: number[],
): void => {
  if (depth === segments.length) {
    found.push(...current.routes);

    return;
  }

  const literal = current.literal.get(segments[depth]);

  if (literal) collect(literal, segments, depth + 1, found);

  if (current.param) collect(current.param, segments, depth + 1, found);
};

/**
 * Compiles routes into a {@link RouteTrie}. The trie holds the expressible
 * routes; the rest are reported in {@link RouteTrie.inexpressible} and left
 * to {@link matchRoute}.
 */
export function compileRouteTrie(routes: CompiledRoute[]): RouteTrie {
  const root = node();
  const inexpressible: InexpressibleRoute[] = [];

  routes.forEach((route, index) => {
    const reason = classify(route);

    if (reason) {
      inexpressible.push(reason);

      return;
    }

    for (const spelling of spellingsOf(route)) insert(root, spelling, index);
  });

  const match = (pathname: string): RouteMatch | null => {
    const found: number[] = [];
    collect(root, pathname.split('/'), 0, found);

    if (found.length === 0) return null;

    // Declaration order: matchRoute breaks compare ties and throws by it.
    if (found.length > 1) found.sort((a, b) => a - b);

    // Sorted, so a route that two branches reach sits next to itself.
    const candidates: CompiledRoute[] = [];

    for (let at = 0; at < found.length; at++)
      if (found[at] !== found[at - 1]) candidates.push(routes[found[at]]);

    return matchRoute(candidates, pathname);
  };

  return Object.freeze({ match, inexpressible: Object.freeze(inexpressible) });
}

const reasonText = ({ reason, param }: InexpressibleRoute): string =>
  reason === 'case-insensitive'
    ? 'it compiles caseInsensitive'
    : `its param '${param}' may match a '/'`;

/**
 * The trie {@link RouteIndex}: hand it to
 * {@link index!MountConfig.routeIndex | `MountConfig.routeIndex`} to resolve a
 * 'matcher' mount by segment trie instead of a linear scan. Verdicts are the
 * linear scan's. It throws at construction, naming each route it can't
 * express: a case-insensitive url config, or a path param whose pattern may
 * match a `/`.
 *
 * @example
 * ```ts
 * import { createServerRouter, routeTrie } from 'ui-router-server';
 *
 * const router = createServerRouter({
 *   mounts: {
 *     '/app': {
 *       routes: [{ name: 'home', url: '' }, { name: 'item', url: '/items/:id' }],
 *       routeIndex: routeTrie,
 *     },
 *   },
 * });
 * ```
 */
export const routeTrie: RouteIndex = (routes) => {
  const trie = compileRouteTrie(routes);

  if (trie.inexpressible.length > 0)
    throw new Error(
      `routeTrie can't express ${trie.inexpressible
        .map(
          (left) =>
            `route '${left.route.name}' ('${left.route.pattern}'): ${reasonText(left)}`,
        )
        .join('; ')}`,
    );

  return trie.match;
};
