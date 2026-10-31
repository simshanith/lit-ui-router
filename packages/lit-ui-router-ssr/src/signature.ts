// The hydration signature both halves of the seam read, in a module neither entry reaches through the other.
import { DefType } from '@uirouter/core';
import type { RawParams, StateObject, UIRouterGlobals } from '@uirouter/core';

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
  /** Where values a transporter encoded sit in `resolves`, when the payload marked any. */
  readonly transported?: unknown;
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
 * `state`'s url parameters, its own and inherited, each encoded from `params`
 * as the url spells it. Config params never reach the url, so they stay out.
 *
 * @internal
 */
export const urlParamsOf = (
  state: StateObject,
  params: RawParams,
): Readonly<Record<string, string | string[]>> =>
  Object.fromEntries(
    state
      .parameters()
      .flatMap((param): [string, string | string[]][] =>
        param.location === DefType.CONFIG
          ? []
          : [[param.id, param.type.encode(params[param.id])]],
      ),
  );

/**
 * The state the router stands on and its url parameters: what `prerender()`
 * writes into the signature and what the client compares it against.
 *
 * @internal
 */
export const routeOf = ({
  $current,
  params,
}: UIRouterGlobals): [
  state: string,
  params: Readonly<Record<string, string | string[]>>,
] => [$current.name, urlParamsOf($current, params)];
