import 'lit-ui-router-ssr/register';
import { bootstrap } from 'lit-ui-router-ssr/client';
import { onXrefClick } from './fragment.ts';
import type { FocusDetail, XrefDetail } from './fragment.ts';
import { installLightbox } from './lightbox.ts';
import { createRouter } from './router.ts';
import { installPrefs } from './prefs.ts';
import { applyTheme, readTheme } from './theme.ts';
import { page } from './views.ts';
import type { TypedStateService } from 'ui-router-registry';
// --- EXPERIMENTAL LAYER ---------------------------------------------------
// The one line that ties the optional half in. Delete this import, the call
// below, and src/experimental/, and the base app is untouched.
import { installExperimental } from './experimental/index.ts';

applyTheme(readTheme());

const router = createRouter();
const stateService: TypedStateService = router.stateService;

// The generated cross-references are plain <a href> (a lit directive cannot
// be attached to inserted markup), so the SPA path is one delegated listener.
document.addEventListener('click', onXrefClick);
document.addEventListener('atlas-xref', (event) => {
  const { num } = (event as CustomEvent<XrefDetail>).detail;
  void stateService.go('atlas.sheet', { num });
});
// A plate's pick is the url's `focus`; taking the event stops its own history write.
document.addEventListener('atlas-focus', (event) => {
  event.preventDefault();
  const { focus, build } = (event as CustomEvent<FocusDetail>).detail;
  // `enlarge` is not inherited either: a pick inside an enlarged figure keeps it open
  const { enlarge } = router.globals.params;
  const params = build === undefined ? { focus, enlarge } : { focus, enlarge, build };
  stateService.go('.', params, { location: 'replace' }).then(
    () => {},
    () => {}, // an ignored or superseded pick is not an error here
  );
});

// EXPERIMENTAL: hooks are registered before start() so the very first
// transition is animated too.
installExperimental(router);

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

// THE BOOT: seed from the signature's payload, start, adopt or render cold; resolves when every awake <ui-view> has updated.
const { outcome, signature, error } = await bootstrap(router, root, page(router), {
  // Every served view reports its wake; anything but an adoption is a finding.
  onAdopt: (view, viewOutcome, viewError) => {
    if (import.meta.env.DEV && viewOutcome !== 'adopted')
      console.warn(`atlas: a served <ui-view> ${viewOutcome}`, view, viewError);
  },
});
document.documentElement.dataset.boot = `${outcome}:${signature}`;
if (import.meta.env.DEV && (outcome !== 'adopted' || signature !== 'matched' || error !== undefined))
  console.warn(`atlas: the boot came to ${outcome}:${signature}`, error);
// the visualizer and trace switches, applied once the first transition has settled
installPrefs(router);

// every figure's ENLARGE button and the url's `?enlarge=`, answered by the document's one lightbox
installLightbox(router);
