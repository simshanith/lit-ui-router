import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../register.js';

import { rootTemplate } from './fixture.js';
import {
  cardPage,
  drawLight,
  framePage,
  hydrateLight,
  outerPage,
  panelPage,
  plainPage,
  wakes,
  watchRemovals,
} from './light-dom-fixture.js';
import type {
  LightCard,
  LightPanel,
  PlainLightCard,
} from './light-dom-fixture.js';
import type { Page } from './round-trip.js';
import { drain, serve } from './round-trip.js';

// Specs marked `it.fails` wait on #904: `LightDomHydrating` from `lit-ui-router-ssr/client` and a light-DOM element renderer from `lit-ui-router-ssr`, both read through `light-dom-api.ts`. Flip each to `it` as it passes.

/** Draws `page` for `path`, serves it, and boots a client into it, counting what the boot removed. */
const roundTrip = async (
  page: Page,
  path: string,
  clientPage: Page = page,
): Promise<{ container: HTMLElement; served: Element[]; removed: Node[] }> => {
  const { container, served } = serve(await drawLight(page, path));
  const stop = watchRemovals(container);
  const release = await hydrateLight(container, clientPage, path);
  await drain(container);
  release();

  return { container, served, removed: stop() };
};

const kept = (container: HTMLElement, served: Element[]): Element[] =>
  served.filter((element) => container.contains(element));

/** Logs each served view's adoption into {@link wakes}, beside the elements' first updates. */
const logAdoptions = (event: Event): void => {
  // SAFETY: `ui-view:adopt` is dispatched from the view element itself.
  wakes.push((event.target as Element).localName);
};

beforeEach(() => {
  wakes.length = 0;
  document.addEventListener('ui-view:adopt', logAdoptions);
});

afterEach(() => {
  document.removeEventListener('ui-view:adopt', logAdoptions);
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('a light-DOM element that opted in', () => {
  // The acceptance line of #904.
  it.fails('renders on the server and hydrates with 0 nodes removed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { container, served } = serve(
      await drawLight(cardPage('served'), '/bare'),
    );

    const label = container.querySelector('#top .card-label');
    // The server drew the element's own render, from its bound property.
    expect(label?.textContent).toBe('served');
    const stop = watchRemovals(container);

    const release = await hydrateLight(container, cardPage('served'), '/bare');
    await drain(container);
    release();

    expect(stop()).toEqual([]);
    expect(kept(container, served)).toHaveLength(served.length);
    expect(container.querySelectorAll('.card-label')).toHaveLength(1);
    expect(container.querySelector('#top .card-label')).toBe(label);
    expect(warn).not.toHaveBeenCalled();
  });

  it.fails('has its bound property before its first update', async () => {
    const { container } = await roundTrip(cardPage('served'), '/bare');
    const card = container.querySelector<LightCard>('#top')!;

    expect(card.labelAtFirstUpdate).toBe('served');
  });

  it.fails('answers an @event listener on the served node', async () => {
    const { container, served } = serve(
      await drawLight(cardPage('served'), '/bare'),
    );

    const button =
      container.querySelector<HTMLButtonElement>('#top .card-button');

    expect(button).not.toBeNull();
    const pressed = vi.fn();
    container.addEventListener('card-press', pressed);

    const release = await hydrateLight(container, cardPage('served'), '/bare');
    await drain(container);
    release();
    button?.click();

    expect(pressed).toHaveBeenCalledOnce();
    expect(kept(container, served)).toHaveLength(served.length);
  });

  it.fails('updates the served node in place on a later property change', async () => {
    const { container } = serve(await drawLight(cardPage('served'), '/bare'));
    const label = container.querySelector('#top .card-label');
    expect(label).not.toBeNull();
    const release = await hydrateLight(container, cardPage('served'), '/bare');
    await drain(container);
    release();
    const card = container.querySelector<LightCard>('#top')!;

    card.label = 'changed';
    await card.updateComplete;

    expect(container.querySelector('#top .card-label')).toBe(label);
    expect(label?.textContent).toBe('changed');
    expect(container.querySelectorAll('.card-label')).toHaveLength(1);
  });
});

describe('a light-DOM element that did not opt in', () => {
  // Today's behaviour, pinned: the server writes the element empty and the client renders it cold, once. A subclass opting in leaves its base as it was.
  it('is served empty and renders cold, once, beside an opted-in subclass', async () => {
    const { container, served } = serve(await drawLight(plainPage, '/bare'));
    const plain = container.querySelector<PlainLightCard>('#plain')!;
    expect(plain.querySelector('.card-label')).toBeNull();
    expect(plain.childNodes).toHaveLength(0);

    const release = await hydrateLight(container, plainPage, '/bare');
    await drain(container);
    release();

    expect(container.querySelector('#plain')).toBe(plain);
    expect(kept(container, served)).toContain(plain);
    expect(plain.querySelectorAll('.card-label')).toHaveLength(1);
    expect(plain.querySelector('.card-label')?.textContent).toBe('plain');
    expect(plain.hasAttribute('defer-hydration')).toBe(false);
  });
});

describe('author children beside the element’s own render', () => {
  it.fails('keeps both, once each, in the order the server wrote them', async () => {
    const { container, served } = serve(await drawLight(panelPage, '/bare'));
    const authored = container.querySelector('#panel .authored');
    const heading = container.querySelector('#panel .panel-heading');
    expect(heading?.textContent).toBe('Panel');
    const stop = watchRemovals(container);

    const release = await hydrateLight(container, panelPage, '/bare');
    await drain(container);
    release();
    const panel = container.querySelector<LightPanel>('#panel')!;

    expect(stop()).toEqual([]);
    expect(kept(container, served)).toHaveLength(served.length);
    expect(panel.querySelector('.authored')).toBe(authored);
    expect(panel.querySelector('.panel-heading')).toBe(heading);
    expect(panel.querySelectorAll('.authored')).toHaveLength(1);
    expect(panel.querySelectorAll('.panel-heading')).toHaveLength(1);
    expect(panel.querySelector('.panel-heading')?.textContent).toBe('Panel');
    expect([...panel.children].map((child) => child.className)).toEqual([
      'authored',
      'panel-heading',
    ]);
  });
});

describe('nesting', () => {
  // A routed card wakes inside its view's adoption; on main `hydrateRoot` also clears `defer-hydration` inside views still asleep, which #1654's per-view sweep stops.
  it.fails('wakes a light-DOM element inside a <ui-view> after that view adopts', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { container, served, removed } = await roundTrip(
      rootTemplate,
      '/card',
    );

    expect(wakes).toEqual(['ui-view', 'light-card#routed']);
    expect(container.querySelector('#routed .card-label')?.textContent).toBe(
      'routed',
    );
    expect(removed).toEqual([]);
    expect(kept(container, served)).toHaveLength(served.length);
    expect(container.querySelectorAll('[defer-hydration]')).toHaveLength(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it.fails('leaves a light-DOM element inside a sleeping view deferred until that view wakes', async () => {
    const { container } = serve(await drawLight(rootTemplate, '/card'));
    const card = container.querySelector('#routed');
    expect(card?.querySelector('.card-label')).not.toBeNull();

    const release = await hydrateLight(container, rootTemplate, '/card');

    // The view is woken but has not updated, so the card inside it still sleeps.
    expect(card?.hasAttribute('defer-hydration')).toBe(true);
    expect(wakes).toEqual([]);
    await drain(container);
    release();
    expect(card?.hasAttribute('defer-hydration')).toBe(false);
    expect(wakes).toEqual(['ui-view', 'light-card#routed']);
  });

  it.fails('wakes a <ui-view> inside a light-DOM element’s own render after that element', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container, served, removed } = await roundTrip(framePage, '/card');

    expect(wakes).toEqual([
      'light-frame#frame',
      'ui-view',
      'light-card#routed',
    ]);
    expect(container.querySelectorAll('.frame-heading')).toHaveLength(1);
    expect(container.querySelectorAll('ui-view')).toHaveLength(1);
    expect(container.querySelector('#routed .card-label')?.textContent).toBe(
      'routed',
    );
    expect(removed).toEqual([]);
    expect(kept(container, served)).toHaveLength(served.length);
    expect(container.querySelectorAll('[defer-hydration]')).toHaveLength(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it.fails('wakes two levels of light-DOM elements parent first', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container, served, removed } = await roundTrip(outerPage, '/bare');
    const inner = container.querySelector<LightCard>('#inner');

    expect(wakes).toEqual(['light-outer#outer', 'light-card#inner']);
    expect(inner?.labelAtFirstUpdate).toBe('Outer inner');
    expect(container.querySelectorAll('.outer-heading')).toHaveLength(1);
    expect(container.querySelectorAll('.card-label')).toHaveLength(1);
    expect(removed).toEqual([]);
    expect(kept(container, served)).toHaveLength(served.length);
    expect(container.querySelectorAll('[defer-hydration]')).toHaveLength(0);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('a server and client render that disagree', () => {
  // Matches `<ui-view>`'s fallback in client.ts: one development warning naming the element, the element's served nodes dropped, a cold render, and nothing thrown.
  it.fails('renders that element cold, warns once, and keeps its surroundings', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errors = vi.fn();
    window.addEventListener('error', errors);

    const { container } = serve(
      await drawLight(cardPage('served', true), '/bare'),
    );

    const sibling = container.querySelector('.sibling');
    // Drawn compact: the client boots the full template over it.
    expect(container.querySelector('#top span.card-label')).not.toBeNull();

    const release = await hydrateLight(container, cardPage('served'), '/bare');
    await drain(container);
    release();
    window.removeEventListener('error', errors);
    const card = container.querySelector<LightCard>('#top')!;

    await expect(card.updateComplete).resolves.toBe(true);
    expect(errors).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain(
      'could not adopt the server render',
    );
    expect(warn.mock.calls[0][1]).toBe('light-card');
    expect(container.querySelectorAll('.card-label')).toHaveLength(1);
    expect(container.querySelector('#top .card-label')?.localName).toBe('p');
    expect(container.querySelector('.sibling')).toBe(sibling);
  });
});
