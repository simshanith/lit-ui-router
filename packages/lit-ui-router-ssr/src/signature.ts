// The hydration signature both halves of the seam read, in a module neither entry reaches through the other.
import { DefType } from '@uirouter/core';
import type { UIRouterGlobals } from '@uirouter/core';

/**
 * What a document's signature block carries, as
 * {@link readHydrationSignature} reads it: `version` checked, the rest as the
 * block holds it.
 *
 * `prerender()` writes `state` as the name of the state the router stood on and
 * `params` as an object of that state's url parameters, each encoded by its
 * type as the url spells it. Narrow both before use.
 */
export interface HydrationSignature {
  /** The `lit-ui-router-ssr` version that drew the document. */
  readonly version: string;
  /** The name of the state the document was drawn for. */
  readonly state?: unknown;
  /** That state's url parameter values, keyed by parameter id. */
  readonly params?: unknown;
  /**
   * The resolved values the document was drawn with, keyed by state name, then
   * by resolve token, when `prerender()`'s `payload` hook supplied them.
   */
  readonly resolves?: unknown;
}

/**
 * Marks the JSON data block that carries the signature, ahead of the rendered
 * body. `hydrate()` walks comments only, so the element is invisible to it.
 *
 * @internal
 */
export const signatureAttribute = 'data-lit-ui-router-ssr';

/**
 * Matches the signature's data block.
 *
 * @internal
 */
export const signatureSelector: string = `script[type="application/json"][${signatureAttribute}]`;

/**
 * This build's version.
 *
 * @internal
 */
export const packageVersion: string = import.meta.env.PACKAGE_VERSION;

/**
 * The state the router stands on and its url parameters, each encoded as the
 * url spells it: what `prerender()` writes into the signature and what the
 * client compares it against. Config params never reach the url, so they stay
 * out.
 *
 * @internal
 */
export const routeOf = ({
  $current,
  params,
}: UIRouterGlobals): [
  state: string,
  params: Readonly<Record<string, string | string[]>>,
] => [
  $current.name,
  Object.fromEntries(
    $current
      .parameters()
      .filter((param) => param.location !== DefType.CONFIG)
      .map((param) => [param.id, param.type.encode(params[param.id])]),
  ),
];
