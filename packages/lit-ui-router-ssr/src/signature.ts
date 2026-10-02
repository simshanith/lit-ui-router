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
 * Opens the comment that carries the signature, ahead of the rendered body.
 * `hydrate()` reads past it: it acts only on `lit-part`, `/lit-part` and
 * `lit-node` comments.
 *
 * @internal
 */
export const signaturePrefix = 'lit-ui-router-ssr ';

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
 * The signature as one comment. `<` and `>` only ever stand inside a JSON
 * string, where `<` and `>` spell them, so no value can close the
 * comment early.
 */
export const signatureComment = (signature: HydrationSignature): string => {
  const json = JSON.stringify(signature)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e');
  return `<!--${signaturePrefix}${json}-->`;
};
