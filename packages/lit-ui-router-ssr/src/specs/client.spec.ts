import { afterEach, describe, expect, it, vi } from 'vitest';
import 'lit-ui-router/register';

import { hydrateRoot } from '../client.js';
import { UiViewRenderer } from '../ui-view-renderer.js';
import { makeRouter, rootTemplate } from './fixture.js';
import {
  boot,
  comments,
  draw,
  dropViewNodeMarkers,
  serve,
} from './round-trip.js';

/** A `<ui-view>`, as the assertions read it. */
type View = Element & { deferHydration: boolean; hasUpdated: boolean };

const views = (container: HTMLElement): View[] =>
  [...container.querySelectorAll('ui-view')] as View[];

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
    for (const view of views(container)) {
      expect(view.deferHydration).toBe(false);
    }
    expect(container.querySelector('h1')?.textContent).toContain('shell hello');
    expect(container.querySelector('.detail')?.textContent).toBe('leaf');
  });

  it('leaves no prefixed marker behind', async () => {
    const { container } = serve(await drawShell('/shell/detail'));

    await boot(container, rootTemplate, '/shell/detail');

    expect(
      comments(container).filter((data) => data.startsWith('ui-view:')),
    ).toEqual([]);
  });

  it('wakes the nested view from the parent’s own hydrate', async () => {
    const { container } = serve(await drawShell('/shell/detail'));
    // Nothing here removes an attribute: the walk the root hydrate starts does.
    const nested = [...container.querySelectorAll('ui-view')].at(-1)!;
    expect(nested.hasAttribute('defer-hydration')).toBe(true);

    await boot(container, rootTemplate, '/shell/detail');

    expect(nested.hasAttribute('defer-hydration')).toBe(false);
    expect(nested.querySelector('.detail')?.textContent).toBe('leaf');
  });

  it('wakes every view from its own slot part, with no node marker to help', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container, served } = serve(await drawShell('/shell/detail'));
    // `@lit-labs/ssr` emits these only under a host-stack entry it leaks for light-DOM renderers, so nothing here may depend on them.
    expect(dropViewNodeMarkers(container)).toBe(2);

    await boot(container, rootTemplate, '/shell/detail');

    const woken = views(container);
    expect(woken).toHaveLength(2);
    for (const view of woken) {
      expect(view.deferHydration).toBe(false);
      expect(view.hasUpdated).toBe(true);
    }
    expect(
      served.filter((element) => container.contains(element)),
    ).toHaveLength(served.length);
    expect(warn).not.toHaveBeenCalled();
    expect(
      comments(container).filter((data) => data.startsWith('ui-view:')),
    ).toEqual([]);
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
