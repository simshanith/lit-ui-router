/** `@lit-labs/ssr`'s DOM shim: the default for `serverRouterPlugin`'s `shim`. @internal */
export const DOM_SHIM: readonly string[] = [
  '@lit-labs/ssr/lib/install-global-dom-shim.js',
];

/**
 * The worker's preloads for a Lit app: the shim modules, then
 * `lit-ui-router-ssr/register` in the registry they installed, then the app's
 * own, each once, at its first position.
 *
 * @internal
 */
export const litPreload = (
  shim: readonly string[],
  preload: readonly string[],
): string[] => [
  ...new Set([...shim, 'lit-ui-router-ssr/register', ...preload]),
];
