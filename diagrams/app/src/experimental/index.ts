/**
 * THE EXPERIMENTAL LAYER.
 *
 * Everything in this directory is optional decoration over a plain
 * lit-ui-router app. Delete `src/experimental/` and the single call to
 * `installExperimental()` in src/main.ts and the base app — states, resolves,
 * uiSref/uiSrefActive, nested ui-view, the location plugin — is unchanged and
 * still correct. Nothing in src/*.ts imports anything from here.
 *
 * What it adds, and which router hook each piece uses:
 *   view-transitions.ts  slideshow between sheets — onBefore (snapshot) and
 *                        transition.promise + two frames (release)
 *   keyboard.ts          ←/→ walk the set — no hook; reads router.globals
 *   megacanvas-pan.ts    pan/zoom the reel to ?at=<sheet> — onSuccess
 */
import type { UIRouterLit } from 'lit-ui-router';
import './experimental.css';
import { installKeyboardWalk } from './keyboard.ts';
import { installMegacanvasPan } from './megacanvas-pan.ts';
import { installSlideshow } from './view-transitions.ts';

export function installExperimental(router: UIRouterLit): void {
  installSlideshow(router);
  installKeyboardWalk(router);
  installMegacanvasPan(router);
}
