import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TemplateResult } from 'lit';
import type { UIRouterLit } from 'lit-ui-router/pure';

// ORDER IS THE POINT: arming patches LitElement before `lit-ui-router` defines
// its tags, so an element upgrading over server markup stays asleep.
const { armLightDom, hydrateRoot, wakeAll } = await import('../client.js');
armLightDom();
await import('lit-ui-router/register');

const { render } = await import('@lit-labs/ssr');
const { collectResultSync } =
  await import('@lit-labs/ssr/lib/render-result.js');
const { withRouterSync } = await import('lit-ui-router/context');
const { UiViewRenderer } = await import('../ui-view-renderer.js');
const { goTo, makeRouter, rootTemplate } = await import('./fixture.js');

/** The document a build would have emitted for `path`. */
const draw = async (path: string): Promise<string> => {
  const router = makeRouter();
  await goTo(router, path);
  return withRouterSync(router, () =>
    collectResultSync(
      render(rootTemplate(router), { elementRenderers: [UiViewRenderer] }),
    ),
  );
};

/** Parses `markup` into a live container and stamps every element it holds. */
const serve = (
  markup: string,
): { container: HTMLElement; served: Element[] } => {
  const container = document.createElement('div');
  document.body.append(container);
  container.innerHTML = markup;
  const served = [...container.querySelectorAll('*')];
  for (const [index, element] of served.entries()) {
    element.setAttribute('data-served', String(index));
  }
  return { container, served };
};

/** Boots a fresh client router into `path` and wakes what the server deferred. */
const boot = async (
  container: HTMLElement,
  path: string,
): Promise<UIRouterLit> => {
  const router = makeRouter();
  const template: TemplateResult = rootTemplate(router);
  expect(hydrateRoot(container, template)).toBe(true);
  const booted = new Promise<void>((resolve) => {
    const off = router.transitionService.onSuccess({}, () => {
      off();
      resolve();
    });
  });
  router.urlService.url(path);
  router.start();
  await booted;
  wakeAll(container);
  return router;
};

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('the round trip', () => {
  it('adopts the server nodes rather than replacing them', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container, served } = serve(await draw('/shell/detail'));

    await boot(container, '/shell/detail');

    const kept = served.filter((element) => container.contains(element));
    expect(kept).toHaveLength(served.length);
    // no fallback anywhere: every part the server wrote matched the client value
    expect(warn).not.toHaveBeenCalled();
  });

  it('leaves no element deferred, and both views live', async () => {
    const { container } = serve(await draw('/shell/detail'));

    await boot(container, '/shell/detail');

    expect(container.querySelectorAll('[defer-hydration]')).toHaveLength(0);
    expect(container.querySelector('h1')?.textContent).toContain('shell hello');
    expect(container.querySelector('.detail')?.textContent).toBe('leaf');
  });

  it('keeps the routed view live across a later transition', async () => {
    const { container } = serve(await draw('/shell/detail'));

    const router = await boot(container, '/shell/detail');
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

describe('a document drawn for another state', () => {
  it('warns once, renders that view cold, and keeps its ancestors', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Drawn with the nested view empty; the client boots into the child state.
    const { container, served } = serve(await draw('/shell'));
    const shell = container.querySelector('h1');

    await boot(container, '/shell/detail');

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
