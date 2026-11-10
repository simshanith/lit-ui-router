// The development-only last renderer that names a shadow-DOM LitElement no listed renderer drew; folded out of dist/*.js by check:dev-split.
import type { RenderInfo } from '@lit-labs/ssr';
import { FallbackRenderer } from '@lit-labs/ssr/lib/element-renderer.js';
import { LitElement } from 'lit';

import { devGate } from '#dev-gate';

/** lit-ui-router's own tags: `<ui-view>` renders light DOM, and `<ui-router>`'s shadow root is a bare slot, so its children are drawn without it. */
const quietTags: ReadonlySet<string> = new Set(['ui-router', 'ui-view']);

/** Tags already warned about; once per tag for the life of the process. */
const warnedTags = new Set<string>();

/**
 * Whether `ceClass` is a `LitElement` that renders into a shadow root: it keeps
 * lit's own `createRenderRoot()`. An override is read as rendering light DOM,
 * as `<ui-view>` and `LightDomHydrating` do.
 */
const rendersShadow = ({ prototype }: typeof HTMLElement): boolean =>
  prototype instanceof LitElement &&
  // oxlint-disable-next-line typescript/dot-notation -- dot access to a protected member does not typecheck
  prototype['createRenderRoot'] === LitElement.prototype['createRenderRoot'];

const warnShadowFallback = (tagName: string): void => {
  // DEV folds the whole body out of dist/*.js; #dev-gate also closes it under node when NODE_ENV is production.
  if (!import.meta.env.DEV || !devGate()) return;

  if (warnedTags.has(tagName)) return;
  warnedTags.add(tagName);
  console.warn(
    'lit-ui-router-ssr: a LitElement that renders into a shadow root reached no renderer that writes one, so it was prerendered as its bare tag, empty: ' +
      `<${tagName}>. ` +
      'A shell element around <ui-view> takes its views with it. ' +
      'Put LitElementRenderer after LightElementRenderer in elementRenderers to draw it.',
  );
};

/**
 * Renders exactly as `@lit-labs/ssr`'s `FallbackRenderer` does, the bare tag
 * and its attributes, and warns once per tag that a shadow-DOM `LitElement`
 * was drawn that way because no listed renderer writes a shadow root.
 *
 * @internal
 */
export class ShadowFallbackRenderer extends FallbackRenderer {
  /** Answers for a `LitElement` that renders into a shadow root, lit-ui-router's own tags aside. */
  static override matchesClass(
    ceClass: typeof HTMLElement,
    tagName: string,
  ): boolean {
    return !quietTags.has(tagName) && rendersShadow(ceClass);
  }

  constructor(tagName: string) {
    super(tagName);
    warnShadowFallback(tagName);
  }
}

/**
 * `renderers` with {@link ShadowFallbackRenderer} last, in development; in
 * production, `renderers` unchanged.
 *
 * @param renderers - the list the render was given
 *
 * @internal
 */
export const withShadowFallback = (
  renderers: RenderInfo['elementRenderers'],
): RenderInfo['elementRenderers'] =>
  import.meta.env.DEV && devGate()
    ? [...renderers, ShadowFallbackRenderer]
    : renderers;
