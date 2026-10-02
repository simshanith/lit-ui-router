// The hydration signature both halves of the seam read, in a module neither entry reaches through the other.
import type { UIRouterLit } from 'lit-ui-router';

/**
 * What `prerender()` states about one document: which release of this package
 * drew it, and the state and parameter values it was drawn for.
 *
 * @category client
 */
export interface HydrationSignature {
  /** The `lit-ui-router-ssr` version that drew the document. */
  readonly version: string;
  /** The name of the state the router stood on when the page rendered. */
  readonly state: string;
  /** Each parameter that state declares, encoded by its type as the url spells it. */
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

/** The signature of the page `router` currently stands on. */
export const signatureOf = (router: UIRouterLit): HydrationSignature => {
  const { $current, params } = router.globals;
  return {
    version: packageVersion,
    state: $current.name,
    params: Object.fromEntries(
      $current
        .parameters()
        .map((param) => [param.id, param.type.encode(params[param.id])]),
    ),
  };
};

/**
 * The signature as one JSON data block. `<` and `>` only ever stand inside a
 * JSON string, where `\u003c` and `\u003e` spell them, so no value can spell
 * `</script` or `<!--` and end the block early.
 */
export const signatureBlock = (signature: HydrationSignature): string => {
  const json = JSON.stringify(signature)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e');
  return `<script type="application/json" ${signatureAttribute}>${json}</script>`;
};
