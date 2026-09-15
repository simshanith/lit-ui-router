import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShadowBadge } from './fixture.js';

// ORDER IS THE POINT: `vitest.setup.coexist.ts` installs lit's own hydrate
// support before `lit`, so the callbacks arming captures here are already its
// patched ones, and both patches are live on the same prototype.
const { armLightDom } = await import('../client.js');
armLightDom();
await import('lit-ui-router/register');

const { UiViewRenderer } = await import('../ui-view-renderer.js');
const { badgeRootTemplate, ShadowBadgeRenderer } = await import('./fixture.js');
const { boot, draw, serve } = await import('./round-trip.js');

/** The document a build would have emitted, with both renderers in play. */
const drawBoth = (path: string): Promise<string> =>
  draw(badgeRootTemplate, [UiViewRenderer, ShadowBadgeRenderer], path);

/** The one node the server drew inside the badge's shadow root. */
const badgeSpan = (container: HTMLElement): Element | null | undefined =>
  container.querySelector('shadow-badge')?.shadowRoot?.querySelector('.badge');

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('alongside lit’s own hydrate support', () => {
  it('runs the round trip without dropping a served node or warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // The premise of this lane: lit's support installed before `lit-element` read for it.
    expect(globalThis).toHaveProperty('litElementHydrateSupport');
    const { container, served } = serve(await drawBoth('/shell/detail'));

    await boot(container, badgeRootTemplate, '/shell/detail');

    const kept = served.filter((element) => container.contains(element));
    expect(kept).toHaveLength(served.length);
    expect(warn).not.toHaveBeenCalled();
    expect(container.querySelectorAll('[defer-hydration]')).toHaveLength(0);
    expect(container.querySelector('h1')?.textContent).toContain('shell hello');
    expect(container.querySelector('.detail')?.textContent).toBe('leaf');
  });

  it('hydrates the shadow-DOM element through lit’s own path', async () => {
    const { container } = serve(await drawBoth('/shell/detail'));
    const server = badgeSpan(container);
    expect(server).toBeTruthy();
    server?.setAttribute('data-server-node', '');

    await boot(container, badgeRootTemplate, '/shell/detail');

    const badge = container.querySelector('shadow-badge') as ShadowBadge;
    // The same node, so lit adopted the server's shadow render rather than re-rendering over it.
    expect(badgeSpan(container)).toBe(server);
    expect(
      badge.shadowRoot?.querySelectorAll('[data-server-node]'),
    ).toHaveLength(1);
    expect(badge.shadowRoot?.querySelectorAll('.badge')).toHaveLength(1);
    expect(badgeSpan(container)?.textContent).toBe('badge');

    // Lit's update consumed its own arming flag, so the next one renders; had this element taken the light-DOM path the flag would still be set and this would hydrate a live root.
    badge.requestUpdate();
    await badge.updateComplete;

    expect(badgeSpan(container)).toBe(server);
    expect(badge.shadowRoot?.querySelectorAll('.badge')).toHaveLength(1);
  });
});
