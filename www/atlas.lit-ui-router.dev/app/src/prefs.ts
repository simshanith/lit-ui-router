/**
 * THE PREFERENCES — two live switches over the router, both off by default:
 * the ui-router visualizer, drawn over the page, and @uirouter/core's trace
 * in the console. Each reads a url override first
 * (`?feature-enable-<name>=true|1|false|0`, the sample apps' form, held for
 * the page's life and shown as forced), then localStorage, then the default.
 * The stored value is a convenience, never a requirement.
 */
import { Category, trace } from '@uirouter/core';
import type { UIRouter } from '@uirouter/core';
import { ARTIFACT } from './mode.ts';

export type PrefName = 'visualizer' | 'trace';

export interface PrefState {
  on: boolean;
  /** Set from the url, so the switch is shown but not thrown. */
  forced: boolean;
}

const KEYS: Record<PrefName, string> = { visualizer: 'atlas-visualizer', trace: 'atlas-trace' };
const TRACE_CATEGORIES = [Category.TRANSITION, Category.VIEWCONFIG, Category.UIVIEW];
const PANES = ['uirStateVisualizer', 'uirTransitionVisualizer'];
// Read at load: the router's first sync rewrites the url without the feature params.
// Optional: @lit-labs/ssr's dom shim has no location (prerender.ts).
const SEARCH = new URLSearchParams(globalThis.location?.search ?? '');

function urlOverride(name: PrefName): boolean | undefined {
  const value = SEARCH.get(`feature-enable-${name}`);
  if (value === null) return undefined;
  return value === 'true' || value === '1';
}

export function readPref(name: PrefName): PrefState {
  const forced = urlOverride(name);
  if (forced !== undefined) return { on: forced, forced: true };
  try {
    return { on: localStorage.getItem(KEYS[name]) === 'on', forced: false };
  } catch {
    return { on: false, forced: false };
  }
}

function writePref(name: PrefName, on: boolean): void {
  try {
    localStorage.setItem(KEYS[name], on ? 'on' : 'off');
  } catch {
    // private windows and blocked site data both throw here
  }
}

let router: UIRouter | undefined;
let visualizer: { dispose(): void } | undefined;
let wanted = false;

function applyTrace(on: boolean): void {
  if (on) trace.enable(...TRACE_CATEGORIES);
  else trace.disable(...TRACE_CATEGORIES);
}

async function applyVisualizer(on: boolean): Promise<void> {
  wanted = on;
  if (!on) {
    visualizer?.dispose();
    visualizer = undefined;
    // dispose unmounts the two panes and leaves their containers on the body
    for (const id of PANES) document.getElementById(id)?.remove();
    return;
  }
  if (visualizer || !router) return;
  const { Visualizer } = await import('@uirouter/visualizer');
  // the switch may have been thrown back while the chunk loaded
  if (!wanted || visualizer) return;
  visualizer = router.plugin(Visualizer);
}

export function setTrace(on: boolean): void {
  writePref('trace', on);
  applyTrace(on);
}

export function setVisualizer(on: boolean): Promise<void> {
  writePref('visualizer', on);
  return applyVisualizer(on);
}

/** Seats the router and applies both stored preferences; after `router.start()`. */
export function installPrefs(target: UIRouter): void {
  router = target;
  applyTrace(readPref('trace').on);
  // the artifact is one offline file with no origin to serve the visualizer's icons
  if (!ARTIFACT) void applyVisualizer(readPref('visualizer').on);
}
