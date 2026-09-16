import { nothing, render } from 'lit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adoptUiViewContext, requestContext } from 'lit-ui-router/context';
import { UiView } from 'lit-ui-router/pure';
import 'lit-ui-router/register';

import { hydrateRoot } from '../client.js';
import { UiViewRenderer } from '../ui-view-renderer.js';
import {
  DetailView,
  fallbackRootTemplate,
  goTo,
  makeRouter,
  plainRootTemplate,
  rootTemplate,
  slottedFallbackRootTemplate,
  tailRootTemplate,
} from './fixture.js';
import type { Page } from './round-trip.js';
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

/** Whether core reported dropping a woken view's held nodes for want of an adopter. */
const dropped = (warn: { mock: { calls: unknown[][] } }): boolean =>
  warn.mock.calls.some(([message]) =>
    String(message).includes('adoptUiViewContext'),
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

/** Requests the adopter and calls it, as a waking view does; false when nobody answered. */
const wake = (view: UiView): boolean => {
  const adopt = requestContext(view, adoptUiViewContext);
  adopt?.(view);
  return adopt !== undefined;
};

describe('the adopter hydrateRoot provides', () => {
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
      return nothing;
    };

    expect(wake(view)).toBe(true);

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

  it('keeps the pair the server wrote for an address no state routed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = servedView('<!--lit-part--><!--/lit-part-->', container);

    expect(wake(view)).toBe(true);

    // The pair is the enclosing template's own part marker; the element renders after it.
    expect(comments(view)).toEqual(['lit-part', '/lit-part']);
    expect(warn).not.toHaveBeenCalled();
  });

  it('leaves a view the document served no markers for to its own fallback', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = servedView('<p class="cold">cold</p>', container);
    const rendered = vi.fn();
    view.render = rendered;

    expect(wake(view)).toBe(true);

    // Nothing here is a render's: the view takes it as its fallback set.
    expect(rendered).not.toHaveBeenCalled();
    expect(view.querySelector('.cold')).not.toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it('answers nothing outside its container', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = servedView(SERVED_SHELL);

    view.removeAttribute('defer-hydration');
    await view.updateComplete;

    expect(view.querySelector('.detail')).toBeNull();
    expect(dropped(warn)).toBe(true);
  });

  it('stops answering once released', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = servedView(SERVED_SHELL, container);
    release();

    view.removeAttribute('defer-hydration');
    await view.updateComplete;

    expect(view.querySelector('.detail')).toBeNull();
    expect(dropped(warn)).toBe(true);
  });

  it('keeps answering when a second hydrateRoot throws on the same container', () => {
    expect(() => hydrateRoot(container, rootTemplate(makeRouter()))).toThrow(
      /live render/,
    );
    const view = servedView(SERVED_SHELL, container);
    const render = vi.fn((): typeof nothing => nothing);
    view.render = render;

    expect(wake(view)).toBe(true);

    // One provider answered: the failed call released its own before rethrowing.
    expect(render).toHaveBeenCalledTimes(1);
  });
});

describe('a view detached before its update flushes', () => {
  it('sleeps until it is re-attached, then adopts through the pin', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container, served } = serve(await drawShell('/shell'));
    const router = makeRouter();
    await goTo(router, '/shell');
    const shell = container.querySelector('h1');

    const release = hydrateRoot(container, rootTemplate(router));
    // The walk woke the view; the app takes the subtree holding it out of the container, and the root provider down, in the same task — before that wake updates.
    const app = container.querySelector('ui-router')!;
    const view = app.querySelector<UiView>('ui-view')!;
    app.remove();
    (release as () => void)();
    await view.updateComplete;

    // Asleep while detached: the held nodes are untouched and nothing adopted them.
    expect(view.querySelector('h1')).toBe(shell);
    expect(view.hasUpdated).toBe(false);
    expect(warn).not.toHaveBeenCalled();

    container.append(app);
    await view.updateComplete;

    // The root provider is gone, so only the pin can have answered.
    expect(view.querySelector('h1')).toBe(shell);
    expect(view.querySelector('h1')?.textContent).toContain('shell hello');
    expect(served.filter((element) => view.contains(element))).toContain(shell);
    expect(warn).not.toHaveBeenCalled();
    // answered once, then off: nothing on the element is left to answer a second request
    expect(requestContext(view, adoptUiViewContext)).toBeUndefined();
  });
});

describe('a view the document drew empty', () => {
  it('keeps the pair the enclosing part is anchored on', async () => {
    const page: Page = (router) => tailRootTemplate(router, 'first');
    const { container } = serve(await draw(page, [UiViewRenderer], '/bare'));

    const router = await boot(container, page, '/bare');
    await router.stateService.go('shell');
    await router.stateService.go('bare');
    // The part standing after the view in the same template still commits.
    render(tailRootTemplate(router, 'second'), container);

    expect(container.querySelector('.tail')?.textContent).toBe('second');
  });
});

describe('a view the document drew with authored fallback content', () => {
  it('parks it for the component the boot routes in', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = serve(
      await draw(fallbackRootTemplate, [UiViewRenderer], '/shell'),
    );
    expect(container.querySelector('.loading')).not.toBeNull();

    await boot(container, fallbackRootTemplate, '/shell');

    expect(container.querySelector('.loading')).toBeNull();
    expect(container.querySelector('h1')?.textContent).toContain('shell hello');
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps it across the boot, and brings the same nodes back', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = serve(
      await draw(fallbackRootTemplate, [UiViewRenderer], '/bare'),
    );
    const loading = container.querySelector('.loading');
    expect(loading).not.toBeNull();

    const router = await boot(container, fallbackRootTemplate, '/bare');
    expect(container.querySelector('.loading')).toBe(loading);

    await router.stateService.go('shell');
    await settle(container);
    expect(container.querySelector('.loading')).toBeNull();
    expect(container.querySelector('h1')?.textContent).toContain('shell hello');

    await router.stateService.go('bare');
    await settle(container);
    expect(container.querySelector('.loading')).toBe(loading);
    expect(warn).not.toHaveBeenCalled();
  });

  it('parks it around the served render it stands in front of', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container, served } = serve(
      await draw(slottedFallbackRootTemplate, [UiViewRenderer], '/shell'),
    );
    const loading = container.querySelector('.loading');
    const shell = container.querySelector('h1');
    expect(loading).not.toBeNull();

    const router = await boot(container, slottedFallbackRootTemplate, '/shell');

    // Adopted, not re-rendered: the server's own heading is the live one.
    expect(container.querySelector('h1')).toBe(shell);
    expect(served.filter((element) => container.contains(element))).toContain(
      shell,
    );
    expect(container.querySelector('.loading')).toBeNull();

    await router.stateService.go('bare');
    await settle(container);
    expect(container.querySelector('.loading')).toBe(loading);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('a view this cannot adopt', () => {
  it('adopts past whitespace, a foreign comment and an injected element', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = serve(await drawShell('/shell/detail'));
    for (const view of views(container)) {
      view.prepend(
        document.createTextNode('\n  '),
        document.createComment('ext'),
        document.createElement('ext-bar'),
      );
    }

    await boot(container, rootTemplate, '/shell/detail');

    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelectorAll('.detail')).toHaveLength(1);
    expect(
      comments(container).filter((data) => data.startsWith('ui-view:')),
    ).toEqual([]);
    for (const view of views(container)) {
      expect(view.deferHydration).toBe(false);
      expect(view.hasUpdated).toBe(true);
    }
    expect(warn).not.toHaveBeenCalled();
  });
});

/** The props `DetailView` was drawn with, as the one render a guest view adopts against. */
const detailProps = { resolves: { detail: 'leaf' } } as unknown as Parameters<
  typeof DetailView
>[0];

/** One served view's markup with its outer pair plain: what the walk passes at the top level. */
const servedDetail = async (): Promise<string> => {
  const { container } = serve(await drawShell('/shell/detail'));
  const nested = [...container.querySelectorAll('ui-view')].at(-1)!;
  const markers = [...nested.childNodes].filter(
    (node) => node.nodeType === Node.COMMENT_NODE,
  ) as Comment[];
  for (const marker of [markers[0], markers.at(-1)!]) {
    marker.data = marker.data.slice('ui-view:'.length);
  }
  const markup = nested.innerHTML;
  container.remove();
  return markup;
};

describe('the pin the walk leaves on a served view', () => {
  it('is installed once, however many walks reach the element', async () => {
    const { container: first } = serve(await drawShell('/shell'));
    const firstRouter = makeRouter();
    await goTo(firstRouter, '/shell');
    const release = hydrateRoot(first, rootTemplate(firstRouter)) as () => void;
    // Detached before its update: the view sleeps, holding its nodes and its pin.
    const app = first.querySelector('ui-router')!;
    const view = app.querySelector<UiView>('ui-view')!;
    app.remove();
    release();

    const { container: second } = serve(await drawShell('/shell'));
    const secondRouter = makeRouter();
    await goTo(secondRouter, '/shell');
    second.querySelector('ui-router')!.replaceWith(app);
    const releaseSecond = hydrateRoot(
      second,
      rootTemplate(secondRouter),
    ) as () => void;
    await settle(second);
    releaseSecond();

    expect(view.querySelector('h1')?.textContent).toContain('shell hello');
    // One pin, answered once: nothing is left to re-adopt this live view.
    expect(requestContext(view, adoptUiViewContext)).toBeUndefined();
  });

  it('adopts a descendant without being spent by it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = serve(await drawShell('/shell/detail'));
    const shell = container.querySelector('h1');
    const router = makeRouter();
    await goTo(router, '/shell/detail');

    // Drawn before the walk: everything from here to the guest's request is one task.
    const markup = await servedDetail();

    const release = hydrateRoot(container, rootTemplate(router)) as () => void;
    // The view the walk woke has not updated yet, so its pin is still armed.
    const view = container.querySelector<UiView>('ui-view')!;
    const guest = document.createElement('ui-view');
    guest.setAttribute('defer-hydration', '');
    guest.innerHTML = markup;
    // The render the served markup was drawn from: a guest registers at an address this document does not fill.
    guest.render = () => DetailView(detailProps);
    view.append(guest);
    const detail = guest.querySelector('.detail');

    const answer = requestContext(guest, adoptUiViewContext);
    expect(answer).toBeTypeOf('function');
    answer?.(guest);

    // Adopted: the served nodes are the ones still standing, and nothing is left hidden.
    expect(guest.querySelector('.detail')).toBe(detail);
    expect(guest.querySelector('.detail')?.textContent).toBe('leaf');
    expect(
      comments(guest).filter((data) => data.startsWith('ui-view:')),
    ).toEqual([]);

    guest.remove();
    release();
    await settle(container);

    // Only the pin is left to answer, and it still belongs to its own view.
    expect(container.querySelector('h1')).toBe(shell);
    expect(dropped(warn)).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('the guard on what there is to adopt', () => {
  it('reports nothing to adopt when the comments were stripped', async () => {
    const markup = (await drawShell('/shell/detail')).replaceAll(
      /<!--[\s\S]*?-->/g,
      '',
    );
    const { container } = serve(markup);
    // The attributes survived the strip; nothing the walk reads did.
    expect(container.querySelector('[defer-hydration]')).not.toBeNull();

    expect(hydrateRoot(container, rootTemplate(makeRouter()))).toBe(false);
  });

  it('hydrates a document whose root marker stands behind whitespace', async () => {
    const { container } = serve(`\n  ${await drawShell('/shell/detail')}`);

    await boot(container, rootTemplate, '/shell/detail');

    expect(container.querySelector('.detail')?.textContent).toBe('leaf');
  });

  it('leaves the container cold-renderable when the walk throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = serve(await drawShell('/shell/detail'));
    const router = makeRouter();
    await goTo(router, '/shell/detail');

    expect(() =>
      hydrateRoot(container, tailRootTemplate(router, 'first')),
    ).toThrow();

    expect(container.querySelectorAll('[defer-hydration]')).toHaveLength(0);
    expect(
      comments(container).filter((data) => data.startsWith('ui-view:')),
    ).toEqual([]);
  });

  it('wakes a custom element the render wrote no marker for', async () => {
    const { container } = serve(
      await draw(plainRootTemplate, [UiViewRenderer], '/shell'),
    );
    expect(
      container.querySelector('plain-mark')?.hasAttribute('defer-hydration'),
    ).toBe(true);

    await boot(container, plainRootTemplate, '/shell');

    expect(container.querySelectorAll('[defer-hydration]')).toHaveLength(0);
  });
});

/** Every argument of every warning, joined. */
const warnedText = (warn: { mock: { calls: unknown[][] } }): string =>
  warn.mock.calls.map((call) => call.map(String).join(' ')).join('\n');

describe('the mismatch warning', () => {
  it('names router.start() when the view had no routed component', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = serve(await drawShell('/shell/detail'));

    await boot(container, rootTemplate, '/shell');

    expect(warnedText(warn)).toContain('router.start()');
  });

  it('says nothing of the boot when the view is routed elsewhere', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = serve(await drawShell('/shell/detail'));

    await boot(container, rootTemplate, '/shell/other');

    expect(warnedText(warn)).toContain('could not adopt the server render');
    expect(warnedText(warn)).not.toContain('router.start()');
    expect(container.querySelector('.other')?.textContent).toBe('other');
  });
});
