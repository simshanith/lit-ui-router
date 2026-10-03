// The hydration signature both halves of the seam read, in a module neither entry reaches through the other.
import { DefType } from '@uirouter/core';
import type { UIRouterLit } from 'lit-ui-router';

/**
 * What a document's signature block carries, as
 * {@link readHydrationSignature} reads it: `version` checked, the rest as the
 * block holds it.
 *
 * `prerender()` writes `state` as the name of the state the router stood on and
 * `params` as an object of that state's url parameters, each encoded by its
 * type as the url spells it. Narrow both before use.
 *
 * @category client
 */
export interface HydrationSignature {
  /** The `lit-ui-router-ssr` version that drew the document. */
  readonly version: string;
  /** The name of the state the document was drawn for. */
  readonly state?: unknown;
  /** That state's url parameter values, keyed by parameter id. */
  readonly params?: unknown;
}

/** The signature as `prerender()` writes it. */
interface WrittenSignature {
  readonly version: string;
  readonly state: string;
  readonly params: Readonly<Record<string, unknown>>;
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

/** The signature of the page `router` currently stands on; config params never reach the url, so they stay out. */
export const signatureOf = (router: UIRouterLit): WrittenSignature => {
  const { $current, params } = router.globals;
  return {
    version: packageVersion,
    state: $current.name,
    params: Object.fromEntries(
      $current
        .parameters()
        .filter((param) => param.location !== DefType.CONFIG)
        .map((param) => [param.id, param.type.encode(params[param.id])]),
    ),
  };
};

/**
 * The signature as one JSON data block. `<` and `>` only ever stand inside a
 * JSON string, where `\u003c` and `\u003e` spell them, so no value can spell
 * `</script` or `<!--` and end the block early.
 */
export const signatureBlock = (signature: WrittenSignature): string => {
  const json = JSON.stringify(signature)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e');
  return `<script type="application/json" ${signatureAttribute}>${json}</script>`;
};
