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
 *                        transition.promise + lit updateComplete (release)
 *   view-rendered.ts     the missing "view has re-rendered" promise, shared
 *   keyboard.ts          ←/→ walk the set, focus follows — no hook; reads router.globals
 *   analytics.ts         the page_views gtag cannot see for itself — onSuccess
 */
import type { UIRouterLit } from 'lit-ui-router';
import { ARTIFACT } from '../mode.ts';
import './experimental.css';
import { installAnalytics } from './analytics.ts';
import { installKeyboardWalk } from './keyboard.ts';
import { installSlideshow } from './view-transitions.ts';

export function installExperimental(router: UIRouterLit): void {
  installSlideshow(router);
  installKeyboardWalk(router);
  // The artifact build is one offline file: no gtag, and no origin to report to.
  if (!ARTIFACT) installAnalytics(router);
}
