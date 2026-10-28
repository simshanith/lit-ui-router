/**
 * The server half: `prerender()` emits a static site from a `ui-router-server`
 * mount table, and `UiViewRenderer` draws `<ui-view>` inside the `@lit-labs/ssr` render.
 *
 * @module
 */
export {
  type EmittedPage,
  type FileWriter,
  prerender,
  type PrerenderOptions,
  type PrerenderResult,
  type PrerenderTally,
  type RedirectLine,
  type RenderContext,
} from './prerender.js';

export { settle, type SettleOptions } from './settle.js';

export { UiViewRenderer } from './ui-view-renderer.js';
