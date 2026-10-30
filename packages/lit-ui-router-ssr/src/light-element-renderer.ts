// The server half of a consumer's light-DOM element: its own render, written into the light DOM instead of a shadow root.
import { LitElementRenderer } from '@lit-labs/ssr';
import type { RenderInfo } from '@lit-labs/ssr';
import type { ThunkedRenderResult } from '@lit-labs/ssr/lib/render-result.js';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { renderValue } from '@lit-labs/ssr/lib/render-value.js';

import { isLightDomClass } from './light-dom-brand.js';
import { prefixInterior } from './served-interior.js';

/**
 * Renders a `LightDomHydrating` element's `render()` into its light DOM,
 * between the part markers its client-side hydrate reads, and writes no shadow
 * root. `LightDomHydrating` ships from `lit-ui-router-ssr/client`, and its
 * brand is what this matches.
 *
 * `LitElementRenderer` does the rest: it builds the element, sets its
 * attributes and properties, and runs `willUpdate`. List this ahead of it in
 * `elementRenderers`, since the first renderer that matches a class wins.
 *
 * The use site writes `${lightSlot()}` inside the element: `@lit-labs/ssr`
 * reaches `renderLight()` only through that part. The pair around the render
 * is written plain and every marker inside it carries the served-marker
 * prefix, as {@link UiViewRenderer} writes a view, so the walk hydrating the
 * surroundings reads past the interior and the element's own wake reveals it.
 * Custom elements inside the render, `<ui-view>` included, are drawn by their
 * own renderers. Collecting the render to prefix it is synchronous, so a
 * render that awaits is not served. `static styles` are not written: a
 * light-DOM element takes the document's styles.
 *
 * @example
 * ```ts
 * import { lightSlot } from 'lit-ui-router-ssr/client';
 * import { LightElementRenderer, prerender, UiViewRenderer } from 'lit-ui-router-ssr';
 *
 * const card = html`<app-card .label=${label}>${lightSlot()}</app-card>`;
 *
 * await prerender({
 *   // …
 *   elementRenderers: [UiViewRenderer, LightElementRenderer],
 * });
 * ```
 */
export class LightElementRenderer extends LitElementRenderer {
  /** Answers for a class `LightDomHydrating` branded, whatever its tag. */
  static override matchesClass(ceClass: typeof HTMLElement): boolean {
    return isLightDomClass(ceClass);
  }

  /** No shadow root: returning nothing is how `@lit-labs/ssr` skips the declarative one. */
  override renderShadow(): ThunkedRenderResult | undefined {
    return undefined;
  }

  /** @internal */
  override renderLight(renderInfo: RenderInfo): ThunkedRenderResult {
    // Element access reaches the protected `render()`, the call LitElementRenderer's own renderShadow makes.
    // oxlint-disable-next-line typescript/dot-notation -- dot access to a protected member does not typecheck
    const value = this.element['render']();

    // Collected synchronously to prefix the interior, as UiViewRenderer does, so a render that awaits is not served.
    return [
      () => prefixInterior(collectResultSync(renderValue(value, renderInfo))),
    ];
  }
}
