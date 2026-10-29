// The brand both halves of light-DOM hydration read, in a module neither entry reaches through the other.

/**
 * Brands a class `LightDomHydrating` produced, so the server renderer and
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

/**
 * Whether `element` is an instance of a light-DOM hydrating class.
 *
 * @param element - the node a walk is passing
 */
export const isLightDomElement = (element: Node): boolean => {
  const { constructor } = element;

  return lightDomBrand in constructor && constructor[lightDomBrand] === true;
};
