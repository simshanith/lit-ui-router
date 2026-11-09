/**
 * The router-wide url options a mount's `config` shares with any
 * `@uirouter/core` router, and the helper that applies them, so a client
 * router, a server mount and a server render read one config object.
 *
 * Core-free at runtime: it only calls the router it is handed, so a browser
 * bundle that imports it pulls in no server code.
 */

import type {
  BuilderFunction,
  RawParams,
  StateObject,
  UIRouter,
  UrlConfig,
  UrlMatcher,
  UrlMatcherCompileConfig,
} from '@uirouter/core';

import { assertRespellable, respell, slashOf } from './trailing-slash.ts';
import type { TrailingSlashPolicy } from './trailing-slash.ts';

export type { TrailingSlash, TrailingSlashPolicy } from './trailing-slash.ts';

/**
 * The url options every `@uirouter/core` router takes through
 * `urlService.config`, and every mount takes through
 * {@link index!MountConfig.config | `MountConfig.config`}. An option left
 * undefined keeps core's default: strict, case-sensitive, no squash.
 */
export interface RouterUrlConfig extends Pick<
  UrlMatcherCompileConfig,
  'strict' | 'caseInsensitive'
> {
  /** Squash policy for defaulted params that don't declare one (default false); value type pinned to core's UrlConfig.defaultSquashPolicy. */
  defaultSquashPolicy?: NonNullable<
    Parameters<UrlConfig['defaultSquashPolicy']>[0]
  >;
  /**
   * Which spelling of a trailing slash is canonical, per kind of state; needs
   * `strict: false`, so both spellings match first. A server mount answers the
   * other spelling with a `308` redirect to the canonical one, and a router
   * this config is applied to formats `href()` and the urls it pushes in the
   * canonical spelling.
   *
   * @example
   * ```ts
   * // pages at /releases/pkg/, response states at the url they were asked for
   * export const urlConfig = {
   *   strict: false,
   *   trailingSlash: { pages: 'always' },
   * } satisfies RouterUrlConfig;
   * ```
   */
  trailingSlash?: TrailingSlashPolicy;
}

// The policy each router formats with; applyUrlConfig installs the decorator once per router.
const policies = new WeakMap<UIRouter, TrailingSlashPolicy | undefined>();

const respellFormat = (router: UIRouter): void => {
  const builder: BuilderFunction = (state: StateObject, parent) => {
    // SAFETY: core's url builder chain returns the state's UrlMatcher, or null for a url-less state.
    const url = parent?.(state) as UrlMatcher | null;
    const slash = slashOf(state.self, policies.get(router));

    if (!url || state.self.url === undefined || slash === 'as-requested')
      return url;
    const format: (values?: RawParams) => string | null = url.format.bind(url);

    const respelled = (values?: RawParams): string | null => {
      const formatted = format(values);

      return formatted === null ? null : respell(formatted, slash);
    };

    // SAFETY: core's format returns null for invalid params, though its type says string.
    url.format = respelled as UrlMatcher['format'];

    return url;
  };

  router.stateRegistry.decorator('url', builder);
};

const compiledUrl = (router: UIRouter): string | undefined => {
  // The root state ('') always exists; its url never reaches a child's regexp.
  const state = router.stateRegistry
    .get()
    .find(({ name, url }) => name !== '' && url);

  if (state) return `state '${state.name}'`;

  const rule = router.urlService.rules
    .rules()
    .find(({ type }) => type === 'URLMATCHER');

  return rule ? 'a url rule' : undefined;
};

/**
 * Applies {@link RouterUrlConfig} to `router` through
 * `urlService.config.strictMode`, `caseInsensitive` and
 * `defaultSquashPolicy`, plus a `stateRegistry` url decorator for
 * `trailingSlash`, and returns the same router.
 *
 * Call it before registering any state or `when()` rule. Core compiles each
 * url when it registers, reading these options then, so a later change
 * never reaches an already registered url. This helper throws instead of
 * silently doing nothing in that case.
 *
 * Undefined options keep the router's current value. An invalid
 * `defaultSquashPolicy` throws core's own error.
 *
 * @typeParam T - the router type, returned unchanged
 * @param router - a router with no url-bearing states or url rules registered yet
 * @param config - the options to apply; a mount's `config` fits as is
 * @returns `router`, for chaining
 * @throws if a state with a url, or a `when()` url rule, is already registered
 * @throws if `trailingSlash` respells a kind of state while the router is strict
 *
 * @example
 * ```ts
 * // url-config.ts, imported by the client and the server alike
 * import type { RouterUrlConfig } from 'ui-router-server/url-config';
 * export const urlConfig = { strict: false } satisfies RouterUrlConfig;
 *
 * // client
 * import { UIRouterLit } from 'lit-ui-router';
 * import { applyUrlConfig } from 'ui-router-server/url-config';
 * const router = applyUrlConfig(new UIRouterLit(), urlConfig);
 * states.forEach((state) => router.stateRegistry.register(state));
 *
 * // server
 * import { createServerRouter } from 'ui-router-server';
 * const server = createServerRouter({
 *   mounts: { '/': { routes, config: urlConfig } },
 * });
 * ```
 */
export function applyUrlConfig<T extends UIRouter>(
  router: T,
  config: RouterUrlConfig = {},
): T {
  const compiled = compiledUrl(router);

  if (compiled)
    throw new Error(
      `applyUrlConfig: ${compiled} is already registered, and core compiled its url under the previous config. Apply the url config before registering states or url rules.`,
    );

  const urlConfig = router.urlService.config;
  urlConfig.strictMode(config.strict);
  urlConfig.caseInsensitive(config.caseInsensitive);
  urlConfig.defaultSquashPolicy(config.defaultSquashPolicy);

  if (config.trailingSlash !== undefined) {
    assertRespellable('applyUrlConfig', {
      strict: urlConfig.strictMode(),
      trailingSlash: config.trailingSlash,
    });

    if (!policies.has(router)) respellFormat(router);
    policies.set(router, config.trailingSlash);
  }

  return router;
}
