import { html, render } from 'lit';
import 'lit-ui-router';
import { onXrefClick } from './fragment.ts';
import type { XrefDetail } from './fragment.ts';
import { createRouter } from './router.ts';
import { applyTheme, readTheme } from './theme.ts';
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

// EXPERIMENTAL: hooks are registered before start() so the very first
// transition is animated too.
installExperimental(router);

router.start();

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');
// The prerendered shell is replaced wholesale: see SSR-VERDICT.md.
root.replaceChildren();
render(
  html`<ui-router .uiRouter=${router}><ui-view></ui-view></ui-router>`,
  root,
);
