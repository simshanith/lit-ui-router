/// <reference types="@types/dom-navigation" />

/**
 * Helpers for the browser project's real Navigation API round-trips.
 *
 * Not a spec file: `src/specs/**\/*.spec.ts` does not collect it.
 */

/**
 * Intercepts every navigation so it commits as a same-document navigation —
 * the URL really changes and `currententrychange` really fires, but the test
 * page is never torn down by a document load.
 *
 * @returns a teardown function that unregisters the interceptor
 */
export function interceptNavigations(): () => void {
  const handler = (event: NavigateEvent) => {
    if (!event.canIntercept) return;
    event.intercept({ handler: () => Promise.resolve() });
  };
  window.navigation.addEventListener('navigate', handler);
  return () => window.navigation.removeEventListener('navigate', handler);
}

/**
 * Restores the tester URL after a test navigated away, intercepting so the
 * restore itself stays same-document.
 */
export async function restoreUrl(href: string): Promise<void> {
  if (window.location.href === href) return;
  const stop = interceptNavigations();
  try {
    await window.navigation.navigate(href, { history: 'replace' }).finished;
  } catch {
    // an aborted restore is not a test failure
  } finally {
    stop();
  }
}
