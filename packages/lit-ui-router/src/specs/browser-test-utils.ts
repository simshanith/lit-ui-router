import { page, UserEventClickOptions } from 'vitest/browser';

// Browser-project-only: vitest/browser has no node implementation.
export function clickLocatedElement(
  element: Element,
  options: UserEventClickOptions = {},
) {
  return page.elementLocator(element).click(options);
}

export interface SuppressedNativeClick {
  type: string;
  tag: string;
  href: string | null;
  /** as observed before this helper cancels the event */
  defaultPrevented: boolean;
}

export interface NativeClickSuppression {
  /** every click/auxclick that reached default-action stage, in order */
  events: SuppressedNativeClick[];
  restore: () => void;
}

let active: NativeClickSuppression | undefined;

// Hash hrefs resolve to the tester URL (live sessionId): an uncancelled
// _blank/modifier/middle click boots a duplicate tester on the channel.
// Bubble-phase so the router's element-level handler decides first.
// Module singleton: the browser-project setup registers the default and
// specs acquire the same handle — a second listener would record the
// first one's preventDefault. A spec needing real default navigation
// calls restore() and re-registers when done.
export function suppressNativeClickNavigation(): NativeClickSuppression {
  if (active) {
    return active;
  }
  const events: SuppressedNativeClick[] = [];
  const listener = (event: Event) => {
    const target = event.target instanceof Element ? event.target : null;
    events.push({
      type: event.type,
      tag: target?.tagName.toLowerCase() ?? 'unknown',
      href: target?.getAttribute('href') ?? null,
      defaultPrevented: event.defaultPrevented,
    });
    event.preventDefault();
  };
  window.addEventListener('click', listener);
  window.addEventListener('auxclick', listener);
  active = {
    events,
    restore: () => {
      window.removeEventListener('click', listener);
      window.removeEventListener('auxclick', listener);
      active = undefined;
    },
  };
  return active;
}
