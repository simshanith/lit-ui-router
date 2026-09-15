import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideUiView } from 'lit-ui-router/context';
import { UiView } from 'lit-ui-router/pure';
import 'lit-ui-router/register';

import { hydrateRoot } from '../client.js';
import { UiViewRenderer } from '../ui-view-renderer.js';
import { makeRouter, rootTemplate } from './fixture.js';
import {
  boot,
  comments,
  draw,
  dropViewNodeMarkers,
  hydrateInto,
  serve,
  settle,
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
    // Drawn with the nested view routed; the client boots into the parent state.
    const { container, served } = serve(await drawShell('/shell/detail'));
    const shell = container.querySelector('h1');

    await boot(container, rootTemplate, '/shell');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(
      'could not adopt the server render',
    );
    // the view the document was not drawn for dropped the server's nodes
    expect(container.querySelector('.detail')).toBeNull();
    // the shell's own nodes were hydrated, not thrown away with the mismatch
    expect(container.querySelector('h1')).toBe(shell);
    expect(served.filter((element) => container.contains(element))).toContain(
      shell,
    );
  });

  it('says nothing when the document drew that view empty', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // The empty pair carries no render to adopt, so the view renders cold in silence.
    const { container } = serve(await drawShell('/shell'));

    await boot(container, rootTemplate, '/shell/detail');

    expect(warn).not.toHaveBeenCalled();
    expect(container.querySelector('.detail')?.textContent).toBe('leaf');
  });
});

/**
 * The markers `UiViewRenderer` writes around and inside one view, as strings:
 * the outer pair plain, everything the view owns prefixed, and a nested view
 * whose own interior the parent's prefixing left alone.
 */
const SERVED_SHELL = [
  '<!--lit-part SHELL-->',
  '<h1>shell <!--ui-view:lit-part-->hello<!--ui-view:/lit-part--></h1>',
  '<ui-view defer-hydration>',
  '<!--ui-view:lit-part DETAIL-->',
  '<!--ui-view:lit-part-->',
  '<p class="detail">leaf</p>',
  '<!--ui-view:/lit-part-->',
  '<!--ui-view:/lit-part-->',
  '</ui-view>',
  '<!--/lit-part-->',
].join('');

/** Whether core reported dropping a woken view's held nodes for want of a consumer. */
const dropped = (warn: { mock: { calls: unknown[][] } }): boolean =>
  warn.mock.calls.some(([message]) =>
    String(message).includes('no consumer took it'),
  );

/** A served `<ui-view>`, asleep, holding exactly what the server wrote into it. */
const servedView = (
  markup: string,
  parent: ParentNode = document.body,
): UiView => {
  const view = document.createElement('ui-view');
  view.setAttribute('defer-hydration', '');
  view.innerHTML = markup;
  parent.append(view);
  return view;
};

describe('the consumer hydrateRoot installs', () => {
  let container: HTMLElement;
  let release: () => void;

  beforeEach(async () => {
    ({ container } = serve(await drawShell('/shell/detail')));
    ({ release } = await hydrateInto(container, rootTemplate, '/shell/detail'));
    await settle(container);
  });

  afterEach(() => {
    release();
  });

  it('reveals the view’s own markers and leaves a nested view closed', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = servedView(SERVED_SHELL, container);
    let revealed: string[] = [];
    // The reveal has to be done by the time core's `render()` is read, because that value is what hydrates against these markers.
    view.render = () => {
      revealed = comments(view);
      return document.createDocumentFragment();
    };

    expect(provideUiView(view)).toBe(true);

    expect(revealed).toEqual([
      'lit-part SHELL',
      'lit-part',
      '/lit-part',
      'lit-part DETAIL',
      'ui-view:lit-part',
      'ui-view:/lit-part',
      '/lit-part',
      '/lit-part',
    ]);
  });

  it('drops the pair the server wrote for an address no state routed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = servedView('<!--lit-part--><!--/lit-part-->', container);

    expect(provideUiView(view)).toBe(true);

    expect(comments(view)).toEqual([]);
    expect(view.childNodes).toHaveLength(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it('leaves a view the document served no markers for exactly as it is', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = servedView('<p class="cold">cold</p>', container);
    const render = vi.fn();
    view.render = render;

    expect(provideUiView(view)).toBe(true);

    expect(render).not.toHaveBeenCalled();
    expect(view.innerHTML).toBe('<p class="cold">cold</p>');
    expect(warn).not.toHaveBeenCalled();
  });

  it('takes nothing offered outside its container', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = servedView(SERVED_SHELL);

    view.removeAttribute('defer-hydration');
    await view.updateComplete;

    expect(view.querySelector('.detail')).toBeNull();
    expect(dropped(warn)).toBe(true);
  });

  it('stops taking once released', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = servedView(SERVED_SHELL, container);
    release();

    view.removeAttribute('defer-hydration');
    await view.updateComplete;

    expect(view.querySelector('.detail')).toBeNull();
    expect(dropped(warn)).toBe(true);
  });

  it('keeps taking when a second hydrateRoot throws on the same container', () => {
    expect(() => hydrateRoot(container, rootTemplate(makeRouter()))).toThrow(
      /live render/,
    );
    const view = servedView(SERVED_SHELL, container);
    const render = vi.fn(() => document.createDocumentFragment());
    view.render = render;

    expect(provideUiView(view)).toBe(true);

    // One consumer answered: the failed call released its own before rethrowing.
    expect(render).toHaveBeenCalledTimes(1);
  });
});
