// THE ADOPT HALF FIRST: this patches LitElement and <ui-view> before either is
// registered, so an element that upgrades over server-rendered light DOM stays
// asleep instead of rendering over it. See src/hydrate-ui-view.ts — it is the
// prototype of `lit-ui-router-ssr/client` (spike #898).
import { hydrateRoot, wakeAll } from './hydrate-ui-view.ts';
import { render } from 'lit';
import 'lit-ui-router';
import { onXrefClick } from './fragment.ts';
import type { XrefDetail } from './fragment.ts';
import { installLattice } from './lattice.ts';
import { createRouter } from './router.ts';
import { applyTheme, readTheme } from './theme.ts';
import { rootTemplate } from './views.ts';
// --- EXPERIMENTAL LAYER ---------------------------------------------------
// The one line that ties the optional half in. Delete this import, the call
// below, and src/experimental/, and the base app is untouched.
import { installExperimental } from './experimental/index.ts';

applyTheme(readTheme());
// The cover's field: `<atlas-lattice>` is inert markup until this defines it.
installLattice();

const router = createRouter();

// The generated cross-references are plain <a href> (a lit directive cannot
// be attached to inserted markup), so the SPA path is one delegated listener.
document.addEventListener('click', onXrefClick);
document.addEventListener('atlas-xref', (event) => {
  const { num } = (event as CustomEvent<XrefDetail>).detail;
  void router.stateService.go('atlas.sheet', { num });
});

// EXPERIMENTAL: hooks are registered before start() so the very first
// transition is animated too.
installExperimental(router);

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

const template = rootTemplate(router);

// THE SEAM. `hydrateRoot` adopts the prerendered tree when there is one — the
// deferred elements are already asleep, their content is sheltered from the
// walk, and the root template is hydrated rather than rendered. The views are
// woken once the boot transition has succeeded, which is the point at which
// `<ui-view>` knows its component and can hydrate what the server drew.
if (hydrateRoot(root, template)) {
  const booted = new Promise<void>((resolve) => {
    const off = router.transitionService.onSuccess({}, () => {
      off();
      resolve();
    });
  });
  router.start();
  void booted.then(() => {
    wakeAll(root);
  });
} else {
  // No prerender (vite dev, the artifact build): the cold client render.
  router.start();
  root.replaceChildren();
  render(template, root);
}
