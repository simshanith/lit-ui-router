// The Views' page side for lit-ui-router; it reads the DOM and the public members of `<ui-view>`, and imports neither lit-ui-router nor lit.
import type { UIRouter } from '@uirouter/core';
import type { ViewInfo } from './schema.ts';
import type { ViewLocator } from './views.ts';

/** The public members of lit-ui-router's `<ui-view>` that the locator reads. */
interface UiViewElement extends HTMLElement {
  name?: string;
  uiRouter?: unknown;
}

/** Options for {@link litViewLocator}. */
export interface LitViewLocatorOptions {
  /** The document whose `<ui-view>`s are searched, open shadow roots included; the page's own by default. */
  document?: Document;
}

const isView = (element: Element): element is UiViewElement =>
  element.localName === 'ui-view';

// Every element under `root`, in document order, through open shadow roots.
function* elementsIn(root: ParentNode): Generator<Element> {
  for (const element of root.querySelectorAll('*')) {
    yield element;

    if (element.shadowRoot) yield* elementsIn(element.shadowRoot);
  }
}

// The way a view's request for its parent travels: through the slot it is assigned to, else up, out of a shadow root to its host.
const above = (element: Element): Element | null => {
  if (element.assignedSlot) return element.assignedSlot;

  if (element.parentElement) return element.parentElement;

  const root = element.getRootNode();

  return root instanceof ShadowRoot ? root.host : null;
};

const nameOf = (view: UiViewElement): string =>
  view.name || view.getAttribute('name') || '$default';

// A view's fqn as lit-ui-router builds it: the names of the views around it, up to a `<ui-router>`, which roots a tree of its own.
const fqnOf = (view: UiViewElement): string => {
  const names = [nameOf(view)];

  for (let at = above(view); at && at.localName !== 'ui-router'; at = above(at))
    if (isView(at)) names.unshift(nameOf(at));

  return names.join('.');
};

/** The router's `<ui-view>` elements for a view, by its fqn; two views can share one. */
const elementsFor = (
  router: UIRouter,
  document: Document,
  view: ViewInfo,
): UiViewElement[] =>
  [...elementsIn(document)].filter(
    (element): element is UiViewElement =>
      isView(element) &&
      element.uiRouter === router &&
      fqnOf(element) === view.fqn,
  );

const union = (rects: readonly DOMRect[]): DOMRect | null => {
  const drawn = rects.filter((rect) => rect.width > 0 && rect.height > 0);

  if (!drawn.length) return null;

  const left = Math.min(...drawn.map((rect) => rect.left));
  const top = Math.min(...drawn.map((rect) => rect.top));
  const right = Math.max(...drawn.map((rect) => rect.right));
  const bottom = Math.max(...drawn.map((rect) => rect.bottom));

  return new DOMRect(left, top, right - left, bottom - top);
};

// A `<ui-view>` is inline by default, so its box is the union of its own and its children's.
const boxOf = (element: Element): DOMRect | null =>
  union([
    element.getBoundingClientRect(),
    ...[...element.children].map((child) => child.getBoundingClientRect()),
  ]);

const where = (element: Element): string => {
  const root = element.getRootNode();
  const host = root instanceof ShadowRoot ? root.host.localName : null;
  const name = element.getAttribute('name');
  const tag = name ? `<ui-view name="${name}">` : '<ui-view>';

  return host ? `${tag} in <${host}>` : tag;
};

const OVERLAY = 'data-ui-router-devtools-view';

const draw = (overlay: HTMLElement, rect: DOMRect) => {
  Object.assign(overlay.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
};

const createOverlay = (document: Document, label: string): HTMLElement => {
  const overlay = document.createElement('div');

  overlay.setAttribute(OVERLAY, label);
  overlay.setAttribute('aria-hidden', 'true');
  Object.assign(overlay.style, {
    position: 'fixed',
    zIndex: '2147483646',
    boxSizing: 'border-box',
    pointerEvents: 'none',
    outline: '2px solid Highlight',
    outlineOffset: '-1px',
    background: 'color-mix(in srgb, Highlight 12%, transparent)',
  });

  return overlay;
};

/**
 * Finds the `<ui-view>` behind a view the panel names, and outlines it on the page while the Views point at it.
 * Elements are matched by router and fqn, which `<ui-view>` builds from its `name` and the views around it.
 *
 * @example
 * ```ts
 * import type { UIRouter } from '@uirouter/core';
 * import { DevtoolsPlugin } from 'ui-router-devtools/plugin';
 * import { litViewLocator } from 'ui-router-devtools/lit-ui-router';
 *
 * declare const router: UIRouter;
 *
 * router.plugin(DevtoolsPlugin, { viewLocator: litViewLocator });
 * ```
 */
export const litViewLocator = (
  router: UIRouter,
  { document = globalThis.document }: LitViewLocatorOptions = {},
): ViewLocator => {
  let shown: { overlay: HTMLElement; stop: () => void } | undefined;

  const clear = () => {
    shown?.stop();
    shown?.overlay.remove();
    shown = undefined;
  };

  return {
    highlight: (view) => {
      clear();

      const [element] = view ? elementsFor(router, document, view) : [];
      const rect = element && boxOf(element);

      if (!view || !element || !rect) return;

      const overlay = createOverlay(document, view.fqn);

      const follow = () => {
        const now = boxOf(element);

        if (now) draw(overlay, now);
      };

      draw(overlay, rect);
      document.body.append(overlay);
      document.addEventListener('scroll', follow, {
        capture: true,
        passive: true,
      });
      document.defaultView?.addEventListener('resize', follow);
      shown = {
        overlay,
        stop: () => {
          document.removeEventListener('scroll', follow, { capture: true });
          document.defaultView?.removeEventListener('resize', follow);
        },
      };
    },
    describe: (view) => {
      const [element] = elementsFor(router, document, view);

      if (!element) return null;

      return boxOf(element)
        ? where(element)
        : `${where(element)}, not displayed`;
    },
  };
};
