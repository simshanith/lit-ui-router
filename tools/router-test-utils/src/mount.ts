/**
 * Structurally-typed <ui-router> mount helpers shared by lit-ui-router and
 * lit-ui-router-mobx specs. Deliberately free of any lit-ui-router dependency
 * (keeps the package graph acyclic): the consumer registers the <ui-router>
 * custom element by importing its own package; these helpers only create the
 * tag and assign the router property.
 */

/** The <ui-router> element shape these helpers rely on. */
export interface UiRouterHost<R> extends HTMLElement {
  uiRouter: R | undefined;
}

export interface MountedInRouter<E extends Element, R> {
  element: E;
  uiRouterEl: UiRouterHost<R>;
  container: HTMLElement;
  cleanup: () => void;
}

function tick(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Waits out a LitElement-style update cycle, if the element has one. */
async function settle(element: Element): Promise<void> {
  await (element as Partial<{ updateComplete: Promise<unknown> }>)
    .updateComplete;
  await tick();
}

/**
 * Mounts an existing element inside a <ui-router> context.
 *
 * The single owner of the append ordering: the <ui-router> parent is
 * connected before its children because happy-dom fires connectedCallback
 * child-before-parent on subtree insertion (real browsers are parent-first),
 * which would break ui-router-context discovery. See lit-ui-router's
 * happy-dom-conformance.spec.ts (canary).
 */
export async function mountElementInRouter<E extends Element, R>(
  element: E,
  router: R,
  container?: HTMLElement,
): Promise<MountedInRouter<E, R>> {
  const ownsContainer = !container;
  const host = container ?? document.createElement('div');
  if (ownsContainer) {
    document.body.appendChild(host);
  }

  const uiRouterEl = document.createElement('ui-router') as UiRouterHost<R>;
  uiRouterEl.uiRouter = router;

  host.appendChild(uiRouterEl);
  uiRouterEl.appendChild(element);

  await settle(uiRouterEl);
  await settle(element);

  return {
    element,
    uiRouterEl,
    container: host,
    cleanup: () => {
      if (ownsContainer) {
        host.remove();
      } else {
        uiRouterEl.remove();
      }
    },
  };
}
