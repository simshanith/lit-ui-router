import { afterEach, describe, expect, it, vi } from 'vitest';

// ORDER IS THE POINT: `vitest.setup.coexist.ts` installs lit's own hydrate support before `lit`, so the mixin runs with that support patched onto `LitElement` underneath it.
import '../register.js';
import { countRetained } from '../testing.js';

import {
  cardPage,
  drawLight,
  hydrateLight,
  plainPage,
  watchRemovals,
} from './light-dom-fixture.js';
import type { LightCard, PlainLightCard } from './light-dom-fixture.js';
import { drain, serve } from './round-trip.js';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('light-DOM elements alongside lit’s own hydrate support', () => {
  it('hydrates an opted-in element with 0 nodes removed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(globalThis).toHaveProperty('litElementHydrateSupport');

    const { container, stamp } = serve(
      await drawLight(cardPage('served'), '/bare'),
    );

    const label = container.querySelector('#top .card-label');
    expect(label?.textContent).toBe('served');
    const stop = watchRemovals(container);

    const release = await hydrateLight(container, cardPage('served'), '/bare');
    await drain(container);
    release();
    const card = container.querySelector<LightCard>('#top')!;

    expect(stop()).toEqual([]);
    expect(countRetained(stamp)).toMatchObject({ removed: 0 });
    expect(container.querySelectorAll('.card-label')).toHaveLength(1);
    expect(container.querySelector('#top .card-label')).toBe(label);
    expect(card.labelAtFirstUpdate).toBe('served');
    expect(card.shadowRoot).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  // Today's behaviour, pinned: lit's support holds the unopted element until the walk clears `defer-hydration`, then it renders cold, once.
  it('renders an element that did not opt in cold, once, with its bound property', async () => {
    const { container } = serve(await drawLight(plainPage, '/bare'));
    const plain = container.querySelector<PlainLightCard>('#plain')!;

    const release = await hydrateLight(container, plainPage, '/bare');
    await drain(container);
    release();

    expect(container.querySelector('#plain')).toBe(plain);
    expect(plain.querySelectorAll('.card-label')).toHaveLength(1);
    expect(plain.labelAtFirstUpdate).toBe('plain');
    expect(plain.shadowRoot).toBeNull();
  });
});
