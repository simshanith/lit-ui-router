import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RoutedLitTemplate, UiView } from 'lit-ui-router/pure';
import { settle } from 'ui-router-server/ssr';

// This runs in the coexist lane: a routed class's shadow root hydrates through lit's own support, which `vitest.setup.coexist.ts` installs.
import '../register.js';

import { hydrateRoot } from '../client.js';
import type { AdoptOutcome } from '../client.js';
import { renderPage } from '../prerender.js';
import { UiViewRenderer } from '../ui-view-renderer.js';
import {
  LightCard,
  makeClassRouter,
  RoutedCard,
  StickyCard,
} from './class-fixture.js';
import { rootTemplate } from './fixture.js';
import { drain, serve } from './round-trip.js';

/** The document a build would have emitted for `path`. */
const drawClass = async (path: string): Promise<string> => {
  const router = makeClassRouter();
  await settle(router, path);

  return renderPage(rootTemplate(router), router, new EventTarget(), [
    UiViewRenderer,
  ]);
};

/** What a boot came to: each view's outcome, and the live router. */
interface Booted {
  outcomes: AdoptOutcome[];
  view: UiView;
  router: ReturnType<typeof makeClassRouter>;
}

/** Hydrates `container` with a fresh client router settled on `path`. */
const bootClass = async (
  container: HTMLElement,
  path: string,
  before?: (view: UiView) => void,
  hydrated?: () => void,
): Promise<Booted> => {
  const router = makeClassRouter();
  await settle(router, path);
  const view = container.querySelector('ui-view')!;
  before?.(view);
  const outcomes: AdoptOutcome[] = [];

  const release = hydrateRoot(container, rootTemplate(router), {
    onAdopt: (_view, outcome) => outcomes.push(outcome),
  });

  if (!release) throw new Error('hydrateRoot left the container cold');
  hydrated?.();
  await drain(container);
  release();

  return { outcomes, view, router };
};

/**
 * Stands in for the core seam this probe asks for: on the view's first render,
 * the class renderer adopts the element the server wrote instead of
 * constructing one, and hands it the props.
 */
const seatServedElement = (view: UiView): void => {
  // SAFETY: `UiView` keeps its routed renderer in a private `component` field, read and written as its own render does.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- the field is private, so no single assertion reaches it
  const internals = view as unknown as { component: RoutedLitTemplate | null };

  const render = view.render.bind(view);
  let seated = false;

  view.render = () => {
    const served = view.querySelector<RoutedCard>(':scope > *');

    if (!seated && internals.component && served) {
      seated = true;
      internals.component = (props): TemplateResult => {
        served._uiViewProps = props;

        return html`${served}${nothing}`;
      };
    }

    return render();
  };
};

/** The node the server drew inside a card's shadow root. */
const servedLeaf = (card: Element | null): Element | null | undefined =>
  card?.shadowRoot?.querySelector('p, span');

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('a prerendered routed LitElement class, with today’s core', () => {
  it('reports adopted, but routes an element the router built and never placed', async () => {
    const { container } = serve(await drawClass('/card'));
    const served = container.querySelector<RoutedCard>('routed-card')!;
    let firstUpdate: Promise<boolean> | undefined;

    // hydrateRoot wakes every deferred non-view element as it returns, so the served card's first update is already queued
    const { outcomes, view } = await bootClass(
      container,
      '/card',
      undefined,
      () => {
        firstUpdate = served.updateComplete;
        firstUpdate.catch(() => {});
      },
    );

    expect(outcomes).toEqual(['adopted']);
    expect(container.contains(served)).toBe(true);
    // lit hydrates a node value as a leaf and never commits it, so the router's own element stays detached
    expect(view.routedElement).not.toBe(served);
    expect(view.routedElement?.isConnected).toBe(false);
    expect(served._uiViewProps).toBeUndefined();
    // the served card woke without props, so its own hydrate met the template it renders unrouted
    await expect(firstUpdate).rejects.toThrow('Hydration value mismatch');
  });
});

describe('a prerendered routed LitElement class, with the element adopted', () => {
  it('adopts the served element and its shadow root, without a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = serve(await drawClass('/card'));
    const served = container.querySelector<RoutedCard>('routed-card');
    const leaf = servedLeaf(served);
    expect(leaf?.textContent).toBe('card leaf');

    const { outcomes, view } = await bootClass(
      container,
      '/card',
      seatServedElement,
    );

    expect(outcomes).toEqual(['adopted']);
    expect(view.routedElement).toBe(served);
    expect(served?.hasAttribute('routed')).toBe(true);
    // the same node, so the element hydrated its served shadow root rather than rendering over it
    expect(servedLeaf(served)).toBe(leaf);
    expect(served?.shadowRoot?.querySelectorAll('p, span')).toHaveLength(1);
    expect(served?._uiViewProps?.resolves.detail).toBe('card leaf');
    expect(container.querySelectorAll('[defer-hydration]')).toHaveLength(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it('hands the adopted element the props before its own first update', async () => {
    const { container } = serve(await drawClass('/card'));
    const served = container.querySelector<RoutedCard>('routed-card')!;

    await bootClass(container, '/card', seatServedElement);
    await served.updateComplete;

    // without props the card renders `.unrouted`, which its hydrate would have thrown on
    expect(served.hasUpdated).toBe(true);
    expect(served.shadowRoot?.querySelector('.unrouted')).toBeNull();
  });

  it('adopts a sticky class the same way', async () => {
    const { container } = serve(await drawClass('/sticky'));
    const served = container.querySelector<StickyCard>('sticky-card');
    const leaf = servedLeaf(served);

    const { outcomes, view } = await bootClass(
      container,
      '/sticky',
      seatServedElement,
    );

    expect(outcomes).toEqual(['adopted']);
    expect(view.routedElement).toBe(served);
    expect(servedLeaf(served)).toBe(leaf);
    expect(leaf?.textContent).toBe('sticky leaf');
  });

  it('swaps the adopted element out on a later transition', async () => {
    const { container } = serve(await drawClass('/card'));
    const served = container.querySelector('routed-card');

    const { router, view } = await bootClass(
      container,
      '/card',
      seatServedElement,
    );

    await router.stateService.go('other');
    await view.updateComplete;

    expect(container.contains(served)).toBe(false);
    expect(container.querySelector('.other')?.textContent).toBe('other');
  });

  it('leaves a light-DOM class behind the declarative shadow root LitElementRenderer wrote', async () => {
    const { container } = serve(await drawClass('/light'));
    const served = container.querySelector<LightCard>('light-card')!;
    const leaf = servedLeaf(served);

    const { outcomes, view } = await bootClass(
      container,
      '/light',
      seatServedElement,
    );

    await served.updateComplete;

    expect(outcomes).toEqual(['adopted']);
    expect(view.routedElement).toBe(served);
    // the element renders cold into its light DOM, under a shadow root with no slot that hides it
    expect(servedLeaf(served)).toBe(leaf);
    expect(served.querySelector(':scope > .light')?.textContent).toContain(
      'light leaf',
    );
  });
});
