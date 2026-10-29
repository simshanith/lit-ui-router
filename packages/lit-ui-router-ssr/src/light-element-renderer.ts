// The server half of a consumer's light-DOM element: its own render, written into the light DOM instead of a shadow root.
import { LitElementRenderer } from '@lit-labs/ssr';
import type { RenderInfo } from '@lit-labs/ssr';
import type { ThunkedRenderResult } from '@lit-labs/ssr/lib/render-result.js';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { renderValue } from '@lit-labs/ssr/lib/render-value.js';

import { isLightDomClass } from './light-dom-brand.js';
import { prefixInterior } from './ui-view-renderer.js';

/**
 * Renders a {@link LightDomHydrating} element's `render()` into its light DOM,
 * between the part markers its client-side hydrate reads, and writes no shadow
 * root.
 *
 * `LitElementRenderer` does the rest: it builds the element, sets its
 * attributes and properties, and runs `willUpdate`. List this ahead of it in
 * `elementRenderers`, since the first renderer that matches a class wins.
 *
 * The use site writes `${renderLight()}` inside the element: that is the only
 * part `@lit-labs/ssr` reaches `renderLight()` through. The pair around the
 * render is written plain and every marker inside it carries the served-marker
 * prefix, as {@link UiViewRenderer} writes a view, so the walk hydrating the
 * surroundings reads past the interior and the element's own wake reveals it.
 *
 * @example
 * ```ts
 * import { renderLight } from '@lit-labs/ssr-client/directives/render-light.js';
 * import { LightElementRenderer, UiViewRenderer } from 'lit-ui-router-ssr';
 *
 * const page = html`<app-card .title=${title}>${renderLight()}</app-card>`;
 * prerender(mounts, { elementRenderers: [UiViewRenderer, LightElementRenderer] });
 * ```
 */
export class LightElementRenderer extends LitElementRenderer {
  /** Answers for a class {@link LightDomHydrating} branded, whatever its tag. */
  static override matchesClass(ceClass: typeof HTMLElement): boolean {
    return isLightDomClass(ceClass);
  }

  /** No shadow root: returning nothing is how `@lit-labs/ssr` skips the declarative one. */
  override renderShadow(): ThunkedRenderResult | undefined {
    return undefined;
  }

  /** @internal */
  override renderLight(renderInfo: RenderInfo): ThunkedRenderResult {
    // TODO(#904 research): author children written alongside `${renderLight()}` at the use site, versus the rendered content; the client's adopter keeps what stands ahead of the pair.
    // TODO(#904 research): `elementStyles` are not written; a light-DOM element's styles belong to the document.
    // Element access reaches the protected `render()`, the call LitElementRenderer's own renderShadow makes.
    // oxlint-disable-next-line typescript/dot-notation -- dot access to a protected member does not typecheck
    const value = this.element['render']();

    // Collected synchronously to prefix the interior, as UiViewRenderer does, so a render that awaits is not served.
    return [
      () => prefixInterior(collectResultSync(renderValue(value, renderInfo))),
    ];
  }
}
