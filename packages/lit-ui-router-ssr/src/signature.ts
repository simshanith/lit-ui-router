// The hydration signature both halves of the seam read, in a module neither entry reaches through the other.

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
