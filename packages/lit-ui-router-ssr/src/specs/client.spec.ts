import { afterEach, describe, expect, it, vi } from 'vitest';

// ORDER IS THE POINT: arming patches LitElement before `lit-ui-router` defines
// its tags, so an element upgrading over server markup stays asleep.
const { armLightDom, hydrateRoot } = await import('../client.js');
armLightDom();
await import('lit-ui-router/register');

const { UiViewRenderer } = await import('../ui-view-renderer.js');
const { makeRouter, rootTemplate } = await import('./fixture.js');
const { boot, bootInto, draw, serve } = await import('./round-trip.js');

/** The document a build would have emitted for `path`. */
const drawShell = (path: string): Promise<string> =>
  draw(rootTemplate, [UiViewRenderer], path);

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('the round trip', () => {
  it('adopts the server nodes rather than replacing them', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container, served } = serve(await drawShell('/shell/detail'));

    await boot(container, rootTemplate, '/shell/detail');

    const kept = served.filter((element) => container.contains(element));
    expect(kept).toHaveLength(served.length);
    // no fallback anywhere: every part the server wrote matched the client value
    expect(warn).not.toHaveBeenCalled();
  });

  it('leaves no element deferred, and both views live', async () => {
    const { container } = serve(await drawShell('/shell/detail'));

    await boot(container, rootTemplate, '/shell/detail');

    expect(container.querySelectorAll('[defer-hydration]')).toHaveLength(0);
    expect(container.querySelector('h1')?.textContent).toContain('shell hello');
    expect(container.querySelector('.detail')?.textContent).toBe('leaf');
  });

  it('keeps the routed view live across a later transition', async () => {
    const { container } = serve(await drawShell('/shell/detail'));

    const router = await boot(container, rootTemplate, '/shell/detail');
    await router.stateService.go('shell');

    expect(container.querySelector('.detail')).toBeNull();
    expect(container.querySelector('h1')?.textContent).toContain('shell hello');
  });

  it('reports nothing to adopt when the container holds a cold render', () => {
    const container = document.createElement('div');
    document.body.append(container);

    expect(hydrateRoot(container, rootTemplate(makeRouter()))).toBe(false);
  });
});

describe('a single element', () => {
  it('wakes when its own `defer-hydration` is removed', async () => {
    const { container } = serve(await drawShell('/shell/detail'));
    await bootInto(container, rootTemplate, '/shell/detail');

    container.querySelector('ui-view')?.removeAttribute('defer-hydration');

    expect(container.querySelector('h1')?.textContent).toContain('shell hello');
    // one level only: the nested view is back in the document, still asleep
    expect(container.querySelectorAll('[defer-hydration]')).toHaveLength(1);
  });

  it('does nothing beyond the original callback when it was not asleep', () => {
    // A `<ui-view>` with no `<ui-router>` over it says so, at length.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const container = document.createElement('div');
    document.body.append(container);
    // Connected without the attribute, the way an element that upgraded before arming did.
    const view = document.createElement('ui-view');
    container.append(view);
    view.setAttribute('defer-hydration', '');

    view.removeAttribute('defer-hydration');

    expect(view.isConnected).toBe(true);
    expect(container.querySelectorAll('[defer-hydration]')).toHaveLength(0);
  });
});

describe('a document drawn for another state', () => {
  it('warns once, renders that view cold, and keeps its ancestors', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Drawn with the nested view empty; the client boots into the child state.
    const { container, served } = serve(await drawShell('/shell'));
    const shell = container.querySelector('h1');

    await boot(container, rootTemplate, '/shell/detail');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(
      'could not adopt the server render',
    );
    expect(container.querySelector('.detail')?.textContent).toBe('leaf');
    // the shell's own nodes were hydrated, not thrown away with the mismatch
    expect(container.querySelector('h1')).toBe(shell);
    expect(served.filter((element) => container.contains(element))).toContain(
      shell,
    );
  });
});
