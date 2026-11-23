// What a host page needs to tell a state fragment from its own anchors. No router, so the page can load it up front.

/**
 * The state URL a fragment carries, or `undefined` when the fragment is the
 * page's own. With the prefix `tour`, `#tour/views` carries `/views`; `#tour`
 * and `#install` carry none. The empty prefix owns every `#/…` fragment.
 */
export function stateUrlOf(hash: string, prefix = ''): string | undefined {
  const fragment = hash.replace(/^#/, '');

  return fragment.startsWith(`${prefix}/`)
    ? fragment.slice(prefix.length)
    : undefined;
}

export interface RevealOptions {
  /**
   * True when the visitor reached this page by following a link inside the
   * host's own client-side navigation, false when the document itself opened
   * on it. A followed link moves focus to the landmark; a page that opens on
   * a fragment moves none, as one that opens on an anchor does.
   */
  followed?: boolean;
}

/**
 * Brings `landmark` into view when the page opens on a state fragment, and
 * when a link outside the landmark is followed to one. A fragment such as
 * `#tour/views` matches no element id, so the browser scrolls nowhere on its
 * own. Links inside the landmark move the app without moving the page.
 *
 * Returns a function that stops listening.
 */
export function revealOnStateLinks(
  landmark: HTMLElement,
  prefix = '',
  { followed = false }: RevealOptions = {},
): () => void {
  // The stylesheet decides the rest: scroll-margin-top for a fixed header, scroll-behavior for motion.
  const reveal = () => landmark.scrollIntoView();

  const follow = () => {
    reveal();
    // As a followed anchor does, when the landmark is focusable (tabindex="-1").
    landmark.focus({ preventScroll: true });
  };

  const onClick = (event: MouseEvent) => {
    // A modified click opens the link elsewhere; this page stays where it is.
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;

    const path = event.composedPath();

    const link = path.find((node) => node instanceof HTMLAnchorElement);

    if (
      !link ||
      link.target ||
      link.hasAttribute('download') ||
      path.includes(landmark)
    )
      return;

    const sameDocument =
      link.origin === location.origin &&
      link.pathname === location.pathname &&
      link.search === location.search;

    // After the click's own navigation, so the entry being left keeps its scroll position.
    if (sameDocument && stateUrlOf(link.hash, prefix) !== undefined)
      requestAnimationFrame(follow);
  };

  if (stateUrlOf(location.hash, prefix) !== undefined) {
    // No focus when the document opens here: script focus before any input draws a focus ring.
    if (followed) follow();
    else reveal();
  }

  document.addEventListener('click', onClick);

  return () => document.removeEventListener('click', onClick);
}
