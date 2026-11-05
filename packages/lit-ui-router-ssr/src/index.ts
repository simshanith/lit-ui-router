/**
 * The server half: `prerender()` emits a static site from a `ui-router-server`
 * mount table, `renderToString()` renders one page for a host that owns the
 * request, and `UiViewRenderer` draws `<ui-view>` inside the `@lit-labs/ssr` render.
 *
 * @module
 */
export {
  type EmittedPage,
  type FileWriter,
  prerender,
  type PrerenderedPage,
  type PrerenderOptions,
  type PrerenderResult,
  type PrerenderTally,
  type RedirectLine,
  type RenderContext,
  type RenderedRedirect,
} from './prerender.js';

export {
  type PagePayload,
  type RenderedPage,
  renderToString,
  type RenderToStringOptions,
} from './render.js';

export {
  redirectedTo,
  type ResolvePayload,
  settle,
  type SettledRedirect,
  type SettleOptions,
} from 'ui-router-server/ssr';

export { LightElementRenderer } from './light-element-renderer.js';

export { type BoundResponses, type Responder, responder } from './respond.js';

export type {
  ResponseContext,
  ResponseHandler,
  ResponseHandlers,
} from 'ui-router-server/ssr';

export { UiViewRenderer } from './ui-view-renderer.js';
