// The #904 API the light-DOM specs read, named once: the mixin from the client entry, the renderers from the server entry.
import type { RenderInfo } from '@lit-labs/ssr';
import { LightElementRenderer, UiViewRenderer } from '../index.js';

export { LightDomHydrating } from '../client.js';

/** An `elementRenderers` entry. */
export type ElementRendererClass = RenderInfo['elementRenderers'][number];

/** The renderers a page draws an opted-in element with. */
export const lightRenderers: ElementRendererClass[] = [
  UiViewRenderer,
  LightElementRenderer,
];
