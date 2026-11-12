/**
 * The trailing-slash policy's shared core: which spelling a state's url
 * takes, and the respelling itself. Matching, redirect formatting and
 * {@link url-config!applyUrlConfig | `applyUrlConfig`}'s href decorator all
 * read it, so a server verdict and a client href agree.
 */

import type { ServerRouter } from './index.ts';

/**
 * How one kind of state spells the trailing slash of its url: `'always'`
 * ends the path with `/`, `'never'` drops it, and `'as-requested'` keeps the
 * spelling a request used and formats urls as their pattern spells them.
 */
export type TrailingSlash = 'always' | 'never' | 'as-requested';

/**
 * A trailing-slash spelling per kind of state, each `'as-requested'` unless
 * given. A delegating state's url belongs to its host handler, so it is
 * always `'as-requested'`.
 */
export interface TrailingSlashPolicy {
  /** States answered with a page: neither a response state nor a delegate. */
  pages?: TrailingSlash;
  /** Response states (see {@link index!RouteDeclaration.response | `response`}). */
  responses?: TrailingSlash;
}

/** The markers that decide a state's kind, from a route or a state declaration. */
export interface SlashKind {
  /** A response state's marker. */
  response?: true;
  /** A delegating state's key. */
  delegate?: string;
}

/** @internal */
export const slashOf = (
  kind: SlashKind,
  policy: TrailingSlashPolicy | undefined,
): TrailingSlash => {
  if (policy === undefined || kind.delegate !== undefined)
    return 'as-requested';

  return (kind.response ? policy.responses : policy.pages) ?? 'as-requested';
};

/** @internal */
export const isRespelling = (
  policy: TrailingSlashPolicy | undefined,
): boolean =>
  policy !== undefined &&
  ((policy.pages ?? 'as-requested') !== 'as-requested' ||
    (policy.responses ?? 'as-requested') !== 'as-requested');

/**
 * `url` with its path respelled for `slash`; the query and fragment stay put.
 *
 * @internal
 */
export const respell = (url: string, slash: TrailingSlash): string => {
  if (slash === 'as-requested') return url;
  const end = url.search(/[?#]/);
  const path = end === -1 ? url : url.slice(0, end);
  const rest = end === -1 ? '' : url.slice(end);

  if (slash === 'always') return path.endsWith('/') ? url : `${path}/${rest}`;

  return path.endsWith('/') ? path.slice(0, -1) + rest : url;
};

/**
 * Throws unless both spellings match before the policy picks one.
 *
 * @internal
 */
export const assertRespellable = (
  where: string,
  config: {
    strict?: boolean;
    trailingSlash?: TrailingSlashPolicy;
  },
): void => {
  if (isRespelling(config.trailingSlash) && config.strict !== false)
    throw new Error(
      `${where}: trailingSlash needs strict: false, so both spellings match before the policy picks one`,
    );
};

// Each createServerRouter router's policy by mount base, for prerender.
const mountPolicies = new WeakMap<
  ServerRouter,
  ReadonlyMap<string, TrailingSlashPolicy | undefined>
>();

/** @internal */
export const registerMountPolicies = (
  router: ServerRouter,
  policies: ReadonlyMap<string, TrailingSlashPolicy | undefined>,
): void => {
  mountPolicies.set(router, policies);
};

/**
 * The policy of the mount at `base` on a router from `createServerRouter`;
 * undefined for any other router.
 *
 * @internal
 */
export const mountPolicyOf = (
  router: ServerRouter,
  base: string,
): TrailingSlashPolicy | undefined => mountPolicies.get(router)?.get(base);

/** A path a mount formatted, with one leading slash: an empty leading param formats `//`, which names another host. */
export const onOrigin = (path: string): string => path.replace(/^\/{2,}/, '/');
