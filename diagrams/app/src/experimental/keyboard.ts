/**
 * EXPERIMENTAL — arrow keys walk the set, like a slide deck.
 *
 * Reads the router's own globals rather than tracking state itself:
 * `router.globals.current` / `.params` are the single source of truth for
 * "which sheet am I on", so this stays correct through back/forward, a deep
 * link, and the `/office` redirect alike.
 */
import type { UIRouterLit } from 'lit-ui-router';
import { loadManifest } from '../manifest.ts';

const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function installKeyboardWalk(router: UIRouterLit): void {
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    const active = document.activeElement;
    if (active && (TYPING.has(active.tagName) || (active as HTMLElement).isContentEditable))
      return;
    if (router.globals.current.name !== 'atlas.sheet') return;

    void loadManifest().then((manifest) => {
      const here = String(router.globals.params['num']).toLowerCase();
      const index = manifest.sheets.findIndex((sheet) => sheet.id === here);
      const next = manifest.sheets[index + step];
      if (!next) return;
      event.preventDefault();
      void router.stateService.go('atlas.sheet', { num: next.num });
    });
  });
}
