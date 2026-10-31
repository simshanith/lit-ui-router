/**
 * Measures the hydration round trip: stamp the elements a prerender served
 * before the client boots, then count how many the boot kept.
 *
 * No imports, and each function is self-contained, so `String(stampServed)`
 * and `String(countRetained)` are valid source for a browser page (Playwright's
 * `page.addInitScript`) as well as plain calls in happy-dom or jsdom.
 *
 * @module
 */

/** The served elements under `root`, taken before the client boots. */
export interface ServedStamp {
  /** The container that was stamped; {@link countRetained} walks it again. */
  readonly root: ParentNode;
  /** Every element under `root` at stamp time, open shadow roots included, in document order. */
  readonly elements: readonly Element[];
  /** How many elements were stamped. */
  readonly served: number;
}

/** What the boot did to the stamped elements. */
export interface RetainedCount {
  /** Elements stamped before the boot. */
  served: number;
  /** Stamped elements still under the root. */
  retained: number;
  /** Stamped elements the boot dropped; a hydrated page keeps this at 0. */
  removed: number;
  /** Elements under the root that were not stamped: a re-rendered view, or what a component drew in `firstUpdated`. */
  added: number;
}

/**
 * Stamps every element under `root`, descending into open shadow roots.
 * `root` itself is not counted. Call it after the prerender is in the
 * document and before the client boots.
 */
export const stampServed = (root: ParentNode): ServedStamp => {
  // nested, so the function stays self-contained when serialised into a page
  const walk = (from: ParentNode, into: Element[]): Element[] => {
    for (const element of from.querySelectorAll('*')) {
      into.push(element);

      if (element.shadowRoot) walk(element.shadowRoot, into);
    }

    return into;
  };

  const elements = walk(root, []);

  return { root, elements, served: elements.length };
};

/**
 * Counts which of the stamped elements are still under the stamp's root, and
 * how many elements arrived beside them. A view the client rendered over
 * instead of adopting counts its served elements as removed and its new ones
 * as added.
 */
export const countRetained = (stamp: ServedStamp): RetainedCount => {
  // nested, so the function stays self-contained when serialised into a page
  const walk = (from: ParentNode, into: Element[]): Element[] => {
    for (const element of from.querySelectorAll('*')) {
      into.push(element);

      if (element.shadowRoot) walk(element.shadowRoot, into);
    }

    return into;
  };

  const now = new Set(walk(stamp.root, []));
  const stamped = new Set(stamp.elements);
  let retained = 0;

  for (const element of stamped) {
    if (now.has(element)) retained += 1;
  }

  return {
    served: stamp.served,
    retained,
    removed: stamp.served - retained,
    added: now.size - retained,
  };
};
