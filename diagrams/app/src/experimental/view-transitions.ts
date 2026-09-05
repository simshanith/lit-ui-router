/**
 * EXPERIMENTAL — the drawing set as a slideshow.
 *
 * WHICH ROUTER HOOK, AND WHY (the consumer finding this file exists to record)
 * --------------------------------------------------------------------------
 * `document.startViewTransition(cb)` snapshots the CURRENT document, then runs
 * `cb` and waits on the promise it returns before cross-fading to the new
 * document. That needs two moments a router has to supply: "the DOM is about
 * to change" and "the DOM has finished changing".
 *
 *   onBefore  — the snapshot. It is the earliest hook, it runs before any
 *               resolve, and returning `true` from it leaves the transition
 *               untouched. `onStart` also works, but it fires after resolves
 *               have been kicked off, so a slow resolve would be captured
 *               inside the frozen old snapshot and the page would appear
 *               hung for the length of the fetch. onBefore is the right one.
 *   trans.promise + two frames — the release. This is the gap: ui-router has
 *               no "the view has been re-rendered" hook. `onSuccess` fires
 *               when the TRANSITION succeeded, and `<ui-view>` swaps its
 *               component in a lit update AFTER that, so resolving the view
 *               transition on onSuccess cross-fades to the OLD content. Two
 *               animation frames after `transition.promise` settles is the
 *               net that actually holds. A `onViewRendered`-style hook (or an
 *               awaitable `updateComplete` on `<ui-view>`) would remove the
 *               guesswork — see SSR-VERDICT.md's asks.
 *
 * Everything here is skipped under `prefers-reduced-motion: reduce`.
 */
import type { Transition } from '@uirouter/core';
import type { UIRouterLit } from 'lit-ui-router';
import { loadManifest } from '../manifest.ts';

/**
 * TWO TRAPS THE PLAYWRIGHT PASS FOUND, both worth knowing before you copy this:
 *
 *  a. Every promise a `ViewTransition` exposes — `ready`, `finished`,
 *     `updateCallbackDone` — REJECTS when the transition is skipped or times
 *     out, and an unattached rejection surfaces as an uncaught page error.
 *     "Transition was skipped" in a console is almost always this and not a
 *     bug in the router. Each one gets a no-op catch below.
 *  b. The browser caps the update callback at ~4s and then aborts with
 *     "Transition was aborted because of timeout in DOM update". Releasing
 *     purely on `transition.promise` blows that cap whenever a route resolves
 *     something big — the megacanvas resolves twenty-one fragments — so the
 *     release is capped, and the heavy state opts out entirely.
 */
interface ViewTransitionHandle {
  ready?: Promise<unknown>;
  finished?: Promise<unknown>;
  updateCallbackDone?: Promise<unknown>;
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => Promise<void> | void) => ViewTransitionHandle;
};

/** Longest the document may stay frozen under a snapshot. */
const RELEASE_CAP_MS = 900;

/** States whose resolves are too heavy to hold a snapshot open for. */
const NO_SLIDESHOW = new Set(['atlas.megacanvas']);

const doc = document as ViewTransitionDocument;

const reducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const supportsViewTransitions = (): boolean =>
  typeof doc.startViewTransition === 'function';

/** Ascent order, so a move from sheet 7 to 8 reads as "forward". */
let order: string[] = [];
void loadManifest().then((manifest) => {
  order = manifest.sheets.map((sheet) => sheet.id);
});

type Direction = 'fwd' | 'back' | 'none';

function directionOf(transition: Transition): Direction {
  const from = transition.from();
  const to = transition.to();
  if (from.name !== 'atlas.sheet' || to.name !== 'atlas.sheet') return 'none';
  const before = order.indexOf(String(transition.params('from')['num']).toLowerCase());
  const after = order.indexOf(String(transition.params('to')['num']).toLowerCase());
  if (before === -1 || after === -1 || before === after) return 'none';
  return after > before ? 'fwd' : 'back';
}

const twoFrames = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

export function installSlideshow(router: UIRouterLit): void {
  router.transitionService.onBefore({}, (transition) => {
    if (reducedMotion()) return true;
    document.documentElement.dataset['atlasDir'] = directionOf(transition);

    if (!supportsViewTransitions()) return true; // the CSS fallback below
    if (NO_SLIDESHOW.has(transition.to().name ?? '')) return true;

    // The snapshot is taken here, synchronously, before any resolve runs.
    let release = (): void => {};
    const domUpdated = new Promise<void>((resolve) => {
      release = resolve;
    });
    const handle = doc.startViewTransition?.(() => domUpdated);
    // (a) every one of these rejects on a skip; unattached, they are page errors
    handle?.ready?.catch(() => {});
    handle?.finished?.catch(() => {});
    handle?.updateCallbackDone?.catch(() => {});

    // (b) release on settle OR failure OR the cap — an aborted transition must
    // never leave the document frozen under a snapshot.
    const cap = setTimeout(release, RELEASE_CAP_MS);
    const finish = (): void => {
      clearTimeout(cap);
      void twoFrames().then(release);
    };
    transition.promise.then(finish, finish);
    return true;
  });

  // The fallback for engines without the API: animate the arriving content.
  if (supportsViewTransitions()) return;
  router.transitionService.onSuccess({}, () => {
    if (reducedMotion()) return;
    const content = document.querySelector('.content');
    if (!(content instanceof HTMLElement)) return;
    content.classList.remove('atlas-enter');
    void content.offsetWidth; // reflow, so the animation restarts
    content.classList.add('atlas-enter');
  });
}
