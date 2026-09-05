/**
 * EXPERIMENTAL — the megacanvas as a reel that pans and zooms to a sheet.
 *
 * `atlas.megacanvas` carries one DYNAMIC search param, `at`. Dynamic is the
 * whole trick: without it, `/megacanvas?at=9` would re-enter the state and
 * re-resolve all twenty-one fragments on every step. With `dynamic: true`
 * the component is never torn down, the resolves never re-run, and the param
 * change arrives as a plain successful transition — which is exactly the
 * shape a CSS transform transition wants.
 *
 * WHICH HOOK: `onSuccess`. Unlike the slideshow (see view-transitions.ts),
 * nothing here has to happen before the DOM changes — the reel is already
 * mounted and only its transform moves — so the latest hook is the right one.
 * The one wrinkle is the same one: `<ui-view>` renders after onSuccess, so on
 * FIRST entry the reel does not exist yet and this waits for it by frame
 * rather than by promise.
 */
import type { UIRouterLit } from 'lit-ui-router';

const MAX_WAIT_FRAMES = 90;

const reducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function hud(stage: HTMLElement, text: string): void {
  let box = stage.querySelector<HTMLElement>('.mega-hud');
  if (!box) {
    box = document.createElement('div');
    box.className = 'mega-hud';
    stage.append(box);
  }
  box.textContent = text;
}

function panTo(stage: HTMLElement, reel: HTMLElement, at: string): void {
  if (!at) {
    reel.style.transform = '';
    hud(stage, 'THE WHOLE REEL · ?at=<sheet> TO PAN');
    return;
  }
  const target = reel.querySelector<HTMLElement>(
    `[id="sheet-${CSS.escape(at)}"]`,
  );
  if (!target) {
    hud(stage, `SHEET ${at} IS NOT ON THE REEL`);
    return;
  }
  const scale = Math.min(1, (stage.clientHeight - 28) / target.offsetHeight);
  // translateY(T) scale(S) maps a point p to T + S·p, so T = -S·top.
  reel.style.transform = `translateY(${String(-target.offsetTop * scale)}px) scale(${String(scale)})`;
  hud(stage, `PANNED TO SHEET ${at} · ${String(Math.round(scale * 100))}%`);
}

// On a DEEP LINK, `.content` itself does not exist yet when onSuccess fires:
// the shell's ui-view renders after the hook. So the stage is looked up by
// frame too, not just the reel inside it.
function whenReady(at: string, frames = 0): void {
  const stage = document.querySelector<HTMLElement>('.content');
  const reel = stage?.querySelector<HTMLElement>('atlas-plate');
  if (stage && reel && reel.childElementCount > 0) {
    stage.classList.add('mega-stage');
    panTo(stage, reel, at);
    return;
  }
  if (frames > MAX_WAIT_FRAMES) return;
  requestAnimationFrame(() => whenReady(at, frames + 1));
}

function leave(): void {
  const stage = document.querySelector<HTMLElement>('.content');
  if (!stage) return;
  stage.classList.remove('mega-stage');
  stage.querySelector('.mega-hud')?.remove();
  const reel = stage.querySelector<HTMLElement>('atlas-plate');
  if (reel) reel.style.transform = '';
}

export function installMegacanvasPan(router: UIRouterLit): void {
  router.transitionService.onSuccess({}, () => {
    if (router.globals.current.name !== 'atlas.megacanvas') {
      leave();
      return;
    }
    if (reducedMotion()) window.scrollTo({ top: 0 });
    whenReady(String(router.globals.params['at'] ?? ''));
  });
}
