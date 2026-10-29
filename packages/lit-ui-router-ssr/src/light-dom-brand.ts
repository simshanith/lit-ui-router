// The brand both halves of light-DOM hydration read, in a module neither entry reaches through the other.

/**
 * Brands a class {@link LightDomHydrating} produced, so the server renderer and
 * a second copy of this package recognise it. `customElements` identity cannot:
 * two copies build two classes.
 */
export const lightDomBrand: unique symbol = Symbol.for(
  'lit-ui-router-ssr#light-dom',
);

/**
 * Whether `constructor` is a light-DOM hydrating class — this package's, or
 * another copy's.
 *
 * @param constructor - the class a registry holds for a tag
 */
export const isLightDomClass = (
  constructor: CustomElementConstructor | typeof HTMLElement | undefined,
): boolean =>
  !!constructor &&
  lightDomBrand in constructor &&
  constructor[lightDomBrand] === true;
