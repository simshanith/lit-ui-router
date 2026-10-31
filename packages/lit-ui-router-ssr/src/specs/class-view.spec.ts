import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UiView } from 'lit-ui-router/pure';
import { settle } from 'ui-router-server/ssr';

// This runs in the coexist lane: a routed class's shadow root hydrates through lit's own support, which `vitest.setup.coexist.ts` installs.
import '../register.js';

import { hydrateRoot } from '../client.js';
import type { AdoptOutcome } from '../client.js';
import { renderPage } from '../prerender.js';
import { UiViewRenderer } from '../ui-view-renderer.js';
import { boundClicks, makeClassRouter } from './class-fixture.js';
import type {
  BoundCard,
  LightCard,
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
): Promise<Booted> => {
  const router = makeClassRouter();
  await settle(router, path);
  const view = container.querySelector('ui-view')!;
  const outcomes: AdoptOutcome[] = [];

  const release = hydrateRoot(container, rootTemplate(router), {
    onAdopt: (_view, outcome) => outcomes.push(outcome),
  });

  if (!release) throw new Error('hydrateRoot left the container cold');
  await drain(container);
  release();

  return { outcomes, view, router };
};

/** The node the server drew inside a card's shadow root. */
const servedLeaf = (card: Element | null): Element | null | undefined =>
  card?.shadowRoot?.querySelector('p, span');

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('a prerendered routed LitElement class', () => {
  it('keeps the element the server wrote, and its shadow root, without a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = serve(await drawClass('/card'));
    const served = container.querySelector<RoutedCard>('routed-card');
    const leaf = servedLeaf(served);
    expect(leaf?.textContent).toBe('card leaf');

    const { outcomes, view } = await bootClass(container, '/card');

    expect(outcomes).toEqual(['adopted']);
    expect(view.routedElement).toBe(served);
    expect(container.querySelector('routed-card')).toBe(served);
    expect(served?.hasAttribute('routed')).toBe(true);
    // the same node, so the element hydrated its served shadow root rather than rendering over it
    expect(servedLeaf(served)).toBe(leaf);
    expect(served?.shadowRoot?.querySelectorAll('p, span')).toHaveLength(1);
    expect(served?._uiViewProps?.resolves.detail).toBe('card leaf');
    expect(container.querySelectorAll('[defer-hydration]')).toHaveLength(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it('hands the adopted element its props before its own first update', async () => {
    const { container } = serve(await drawClass('/card'));
    const served = container.querySelector<RoutedCard>('routed-card')!;

    await bootClass(container, '/card');
    await served.updateComplete;

    // without props the card renders `.unrouted`, which its hydrate would have thrown on
    expect(served.hasUpdated).toBe(true);
    expect(served.shadowRoot?.querySelector('.unrouted')).toBeNull();
  });

  it('keeps the element a sticky class wrote', async () => {
    const { container } = serve(await drawClass('/sticky'));
    const served = container.querySelector<StickyCard>('sticky-card');
    const leaf = servedLeaf(served);

    const { outcomes, view } = await bootClass(container, '/sticky');

    expect(outcomes).toEqual(['adopted']);
    expect(view.routedElement).toBe(served);
    expect(container.querySelector('sticky-card')).toBe(served);
    expect(servedLeaf(served)).toBe(leaf);
    expect(leaf?.textContent).toBe('sticky leaf');
  });

  it('keeps the node markers its own render binds against, so inner bindings hydrate', async () => {
    const markup = await drawClass('/bound');
    const { container } = serve(markup);
    const served = container.querySelector<BoundCard>('bound-card')!;
    const button = served.shadowRoot?.querySelector('button');
    expect(button?.title).toBe('bound leaf');

    const { outcomes, view } = await bootClass(container, '/bound');
    await served.updateComplete;

    expect(outcomes).toEqual(['adopted']);
    expect(view.routedElement).toBe(served);
    expect(served.shadowRoot?.querySelector('button')).toBe(button);
    button?.click();
    expect(boundClicks).toEqual(['bound leaf']);
  });

  it('swaps the adopted element out on a later transition', async () => {
    const { container } = serve(await drawClass('/card'));
    const served = container.querySelector('routed-card');

    const { router, view } = await bootClass(container, '/card');

    await router.stateService.go('other');
    await view.updateComplete;

    expect(container.contains(served)).toBe(false);
    expect(container.querySelector('.other')?.textContent).toBe('other');
  });

  it('keeps a light-DOM element the server wrote bare, and renders it cold into its light DOM', async () => {
    const { container } = serve(await drawClass('/light'));
    const served = container.querySelector<LightCard>('light-card')!;

    const { outcomes, view } = await bootClass(container, '/light');
    await served.updateComplete;

    expect(outcomes).toEqual(['adopted']);
    expect(view.routedElement).toBe(served);
    expect(served.shadowRoot).toBeNull();
    expect(served.querySelectorAll(':scope > .light')).toHaveLength(1);
    expect(served.querySelector('.light')?.textContent?.trim()).toBe(
      'light leaf',
    );
  });
});
