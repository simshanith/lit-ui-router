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

/**
 * Takes over the current history entry with `hash`, keeping the entry's
 * `history.state`, which a host page's own router may use, and dispatches the
 * `hashchange` the History API does not fire.
 */
export function replaceFragment(hash: string): void {
  const oldURL = location.href;

  // The path and query are spelled out: a bare `#…` resolves against a <base href>, not the page's URL.
  history.replaceState(
    history.state,
    '',
    `${location.pathname}${location.search}${hash}`,
  );
  window.dispatchEvent(
    new HashChangeEvent('hashchange', { oldURL, newURL: location.href }),
  );
}

// A modified click opens the link elsewhere; this page stays where it is.
const opensHere = (event: MouseEvent) =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

/** The URL of the link a click follows in this window, or `undefined` when the browser takes it elsewhere. */
function followedUrl(path: EventTarget[]): URL | undefined {
  // By name, not class: the link may be an SVG <a>, which has none of an HTML one's URL members.
  const link = path.find(
    (node): node is Element =>
      node instanceof Element && node.localName === 'a',
  );
  const href = link?.getAttribute('href');

  if (
    !link ||
    href == null ||
    link.getAttribute('target') ||
    link.hasAttribute('download')
  )
    return undefined;

  return new URL(href, link.baseURI);
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
 * own. A link inside the landmark moves the app in place: the page does not
 * scroll, focus stays on the link, and the fragment takes over the history
 * entry, as the app's own `{ location: 'replace' }` links do.
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
    if (!opensHere(event)) return;

    const path = event.composedPath();
    const url = followedUrl(path);

    if (
      !url ||
      url.origin !== location.origin ||
      url.pathname !== location.pathname ||
      url.search !== location.search ||
      stateUrlOf(url.hash, prefix) === undefined
    )
      return;

    if (!path.includes(landmark)) {
      // After the click's own navigation, so the entry being left keeps its scroll position.
      requestAnimationFrame(follow);

      return;
    }

    // Already handled: the app's own links, or a host router that took the click first.
    if (event.defaultPrevented) return;

    event.preventDefault();

    if (url.hash !== location.hash) replaceFragment(url.hash);
  };

  if (stateUrlOf(location.hash, prefix) !== undefined) {
    // No focus when the document opens here: script focus before any input draws a focus ring.
    if (followed) follow();
    else reveal();
  }

  document.addEventListener('click', onClick);

  return () => document.removeEventListener('click', onClick);
}
