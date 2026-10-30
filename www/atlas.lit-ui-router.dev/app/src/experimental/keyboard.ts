/**
 * EXPERIMENTAL — arrow keys walk the set, like a slide deck.
 *
 * Reads the router's settled globals once per key press rather than tracking
 * state itself: the settled route is the single source of truth for "which
 * sheet am I on", so this stays correct through back/forward, a deep link, and
 * the `/office` redirect alike. The sheet list is the shell's `manifest`
 * resolve, read off the transition that landed, so a press fetches nothing.
 *
 * Focus follows the walk: once the arriving sheet has rendered, its title
 * takes focus (without scrolling — the router already scrolled to the top),
 * so a screen reader announces the new plate and the next arrow press still
 * lands on the document rather than on a stale link.
 */
import type { UIRouterLit } from 'lit-ui-router';
import type { TypedStateService } from 'ui-router-registry';
import type { Manifest } from '../manifest.ts';
import { viewRendered } from './view-rendered.ts';

const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

async function focusArrivedSheet(): Promise<void> {
  await viewRendered();
  const target =
    document.querySelector<HTMLElement>('.content .sheet-title') ??
    document.querySelector<HTMLElement>('main.content');
  if (!target) return;
  if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
  target.focus({ preventScroll: true });
}

export function installKeyboardWalk(router: UIRouterLit): void {
  const stateService: TypedStateService = router.stateService;
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    const active = document.activeElement;
    if (active && (TYPING.has(active.tagName) || (active as HTMLElement).isContentEditable))
      return;
    if (!stateService.includes('atlas.sheet')) return;
    const here = String(router.globals.params.num).toLowerCase();

    const landed = router.globals.successfulTransitions.peekTail();
    if (!landed) return;
    const { sheets } = landed.injector().get('manifest') as Manifest;
    const index = sheets.findIndex((sheet) => sheet.id === here);
    const next = sheets[index + step];
    if (!next) return;
    event.preventDefault();
    stateService.go('atlas.sheet', { num: next.num }).then(
      () => focusArrivedSheet(),
      () => {}, // a superseded or rejected walk is not an error here
    );
  });
}
