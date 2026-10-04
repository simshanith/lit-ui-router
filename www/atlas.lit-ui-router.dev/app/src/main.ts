import { Stream } from 'effect';
import { render } from 'lit';
import 'lit-ui-router-ssr/register';
import { hydrateRoot } from 'lit-ui-router-ssr/client';
import { routeRef } from 'lit-ui-router-effect';
import { onXrefClick } from './fragment.ts';
import type { FocusDetail, XrefDetail } from './fragment.ts';
import { createRouter } from './router.ts';
import { runtime } from './runtime.ts';
import { applyTheme, readTheme } from './theme.ts';
import { page } from './views.ts';
// --- EXPERIMENTAL LAYER ---------------------------------------------------
// The one line that ties the optional half in. Delete this import, the call
// below, and src/experimental/, and the base app is untouched.
import { installExperimental } from './experimental/index.ts';

applyTheme(readTheme());
const router = createRouter();

// The generated cross-references are plain <a href> (a lit directive cannot
// be attached to inserted markup), so the SPA path is one delegated listener.
document.addEventListener('click', onXrefClick);
document.addEventListener('atlas-xref', (event) => {
  const { num } = (event as CustomEvent<XrefDetail>).detail;
  void router.stateService.go('atlas.sheet', { num });
});
// A plate's pick is the url's `focus`; taking the event stops its own history write.
document.addEventListener('atlas-focus', (event) => {
  event.preventDefault();
  const { focus } = (event as CustomEvent<FocusDetail>).detail;
  router.stateService.go('.', { focus }, { location: 'replace' }).then(
    () => {},
    () => {}, // an ignored or superseded pick is not an error here
  );
});

// EXPERIMENTAL: hooks are registered before start() so the very first
// transition is animated too.
installExperimental(router);

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

// THE BOOT: seat the route ref, start, await its first settled snapshot on the
// page's runtime, then adopt. `changes` replays the latest value, so a tick
// that lands before the stream subscribes is still seen. The walk wakes every
// served <ui-view> with the settled router already in hand.
const booted = runtime.runPromise(
  Stream.runHead(Stream.filter(routeRef(router).changes, (route) => route.transition !== undefined)),
);
router.start();
await booted;

/** Resolves once the root view's own update — and the microtask after it — is done. */
const pageSettled = async (): Promise<void> => {
  const view = root.querySelector('ui-view');
  await view?.updateComplete;
  await Promise.resolve();
};

let release: false | (() => void) = false;
try {
  release = hydrateRoot(root, page(router), {
    // Every served view reports its wake; anything but an adoption is a finding.
    onAdopt: (view, outcome, error) => {
      if (import.meta.env.DEV && outcome !== 'adopted')
        console.warn(`atlas: a served <ui-view> ${outcome}`, view, error);
    },
  });
} catch (error) {
  // A mutated document: the container comes back cold-renderable.
  if (import.meta.env.DEV) console.warn('atlas: the served page was not adopted', error);
}
if (release) void pageSettled().then(release);
else render(page(router), root);
