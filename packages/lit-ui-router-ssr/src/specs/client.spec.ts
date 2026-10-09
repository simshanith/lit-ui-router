import { nothing, render } from 'lit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestContext } from 'lit-ui-router/context';
import { UiView } from 'lit-ui-router/pure';
import { adoptUiViewContext } from '../adopt-context.js';
import '../register.js';

import {
  hydrateRoot,
  readHydrationSignature,
  uiViewAdoptEventName,
} from '../client.js';
import type { AdoptOutcome, UiViewAdoptEvent } from '../client.js';
import { settle } from '../settle.js';
import { signatureBlock } from '../prerender.js';
import { signatureAttribute, signatureSelector } from '../signature.js';
import { UiViewRenderer } from '../ui-view-renderer.js';
import {
  DetailView,
  fallbackRootTemplate,
  shellRouter,
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
  drain,
  stripComments,
  withoutSignature,
} from './round-trip.js';

/** A `<ui-view>`, as the assertions read it. */
type View = Element & { deferHydration: boolean; hasUpdated: boolean };

const views = (container: HTMLElement): View[] =>
  [...container.querySelectorAll('ui-view')] as unknown as View[];

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

    expect(hydrateRoot(container, rootTemplate(shellRouter()))).toBe(false);
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

  it('renders once over a served view that opens on a nested part', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = serve(await drawShell('/shell/lead'));
    expect(container.querySelectorAll('#plate')).toHaveLength(1);

    await boot(container, rootTemplate, '/shell/detail');

    expect(warn).toHaveBeenCalledTimes(1);
    // Every served sibling after the nested pair went with it, not only that pair.
    expect(container.querySelector('#plate')).toBeNull();
    expect(container.querySelectorAll('.detail')).toHaveLength(1);
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
    await drain(container);
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

  describe('on a mismatch', () => {
    // The pair's interior as the renderer writes it: the view's template pair plain, everything inside prefixed.
    const interiors = {
      'opens on a nested part':
        '<!--ui-view:lit-part--><div class="util" id="util">util</div><!--ui-view:/lit-part-->' +
        '<p class="plate" id="plate">plate</p><p class="caption">caption</p>',
      'holds a nested part in the middle':
        '<p class="lead">lead</p><!--ui-view:lit-part--><span>mid</span><!--ui-view:/lit-part-->' +
        '<p class="plate" id="plate">plate</p>',
      'holds a node marker beside a nested part':
        '<!--ui-view:lit-part-->lead<!--ui-view:/lit-part--><!--ui-view:lit-node 0-->' +
        '<p class="plate" id="plate">plate</p>',
      'holds no nested part': '<p class="plate" id="plate">plate</p>',
    };

    for (const [contents, interior] of Object.entries(interiors)) {
      it(`clears everything up to the matching close when the view ${contents}`, () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const view = servedView(
          `<!--lit-part VIEW-->${interior}<!--/lit-part--><p class="after">after</p>`,
          container,
        );
        const [open, close] = [
          view.firstChild,
          view.lastChild!.previousSibling,
        ];
        view.render = () => {
          throw new Error('drawn for another state');
        };

        expect(wake(view)).toBe(true);

        expect(warn).toHaveBeenCalledTimes(1);
        // The pair itself stays, and so does what the enclosing template wrote after it.
        expect([...view.childNodes]).toEqual([
          open,
          close,
          view.querySelector('.after'),
        ]);
        expect(comments(view)).toEqual(['lit-part VIEW', '/lit-part']);
      });
    }
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

  it('drops the served nodes of a view whose pair the document lost', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Prefixed markers under no plain pair: a render's nodes with nothing left to hydrate against.
    const view = servedView(
      '<!--ui-view:lit-part--><p class="detail">leaf</p><!--ui-view:/lit-part-->',
      container,
    );

    expect(wake(view)).toBe(true);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warnedText(warn)).toContain('the served part pair is gone');
    expect(view.childNodes).toHaveLength(0);
  });

  it('keeps what the author wrote ahead of a render whose pair is gone', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = servedView(
      '<p class="hold">hold</p><!--ui-view:lit-part--><p class="detail">leaf</p><!--ui-view:/lit-part-->',
      container,
    );
    const hold = view.querySelector('.hold');

    expect(wake(view)).toBe(true);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warnedText(warn)).toContain('the served part pair is gone');
    // The render goes; the authored prefix stands, and core captures it as this view's fallback set.
    expect(view.querySelector('.detail')).toBeNull();
    expect([...view.childNodes]).toEqual([hold]);
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
    expect(() => hydrateRoot(container, rootTemplate(shellRouter()))).toThrow(
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
    const router = shellRouter();
    await settle(router, '/shell');
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
    await drain(container);
    expect(container.querySelector('.loading')).toBeNull();
    expect(container.querySelector('h1')?.textContent).toContain('shell hello');

    await router.stateService.go('bare');
    await drain(container);
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
    await drain(container);
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
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container: first } = serve(await drawShell('/shell'));
    const firstRouter = shellRouter();
    await settle(firstRouter, '/shell');
    const release = hydrateRoot(first, rootTemplate(firstRouter)) as () => void;
    // Detached before its update: the view sleeps, holding its nodes and its pin.
    const app = first.querySelector('ui-router')!;
    const view = app.querySelector<UiView>('ui-view')!;
    app.remove();
    release();

    const { container: second } = serve(await drawShell('/shell'));
    const secondRouter = shellRouter();
    await settle(secondRouter, '/shell');
    second.querySelector('ui-router')!.replaceWith(app);
    const releaseSecond = hydrateRoot(
      second,
      rootTemplate(secondRouter),
    ) as () => void;
    await drain(second);
    releaseSecond();

    expect(view.querySelector('h1')?.textContent).toContain('shell hello');
    // One pin, answered once: nothing is left to re-adopt this live view.
    expect(requestContext(view, adoptUiViewContext)).toBeUndefined();
    // The second walk hands the moved <ui-router> its own router.
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'was given a different uiRouter after its first update',
      ),
      app,
    );
  });

  it('adopts a descendant without being spent by it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = serve(await drawShell('/shell/detail'));
    const shell = container.querySelector('h1');
    const router = shellRouter();
    await settle(router, '/shell/detail');

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
    await drain(container);

    // Only the pin is left to answer, and it still belongs to its own view.
    expect(container.querySelector('h1')).toBe(shell);
    expect(dropped(warn)).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('the guard on what there is to adopt', () => {
  it('reports nothing to adopt when the comments were stripped', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const markup = stripComments(await drawShell('/shell/detail'));
    const { container } = serve(markup);
    // The attributes and the signature survived the strip; nothing the walk reads did.
    expect(container.querySelector('[defer-hydration]')).not.toBeNull();
    expect(readHydrationSignature(container)).not.toBeNull();

    expect(hydrateRoot(container, rootTemplate(shellRouter()))).toBe(false);

    expect(container.childNodes).toHaveLength(0);
    expect(warnedText(warn)).toContain('no lit-part marker follows it');
  });

  it('hydrates a document whose signature and root marker stand behind whitespace', async () => {
    // What a formatter that indents the served page leaves around the block.
    const markup = (await drawShell('/shell/detail')).replace(
      '</script>',
      '</script>\n  ',
    );
    const { container } = serve(`\n  ${markup}`);

    await boot(container, rootTemplate, '/shell/detail');

    expect(container.querySelector('.detail')?.textContent).toBe('leaf');
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

/** One report, as both the event and `onAdopt` carry it. */
type Report = [view: Element, outcome: AdoptOutcome, error?: unknown];

/** Every `ui-view:adopt` that reaches `target`, in dispatch order. */
const listen = (target: EventTarget): Report[] => {
  const reports: Report[] = [];
  target.addEventListener(uiViewAdoptEventName, (event) => {
    const { detail, target: view } = event as UiViewAdoptEvent;
    reports.push(
      'error' in detail
        ? [view as Element, detail.outcome, detail.error]
        : [view as Element, detail.outcome],
    );
  });
  return reports;
};

/** The round trip with `onAdopt` wired, returning what the callback received. */
const bootReporting = async (
  container: HTMLElement,
  path: string,
): Promise<Report[]> => {
  const received: Report[] = [];
  const router = shellRouter();
  await settle(router, path);
  const release = hydrateRoot(container, rootTemplate(router), {
    onAdopt: (view, outcome, error) => {
      received.push(
        outcome === 'fell-back' ? [view, outcome, error] : [view, outcome],
      );
    },
  });
  expect(release).toBeTypeOf('function');
  await drain(container);
  (release as () => void)();
  return received;
};

describe('the hydration outcome', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports adopted once per view, parent first, with no error', async () => {
    const { container } = serve(await drawShell('/shell/detail'));
    const reports = listen(document);

    const received = await bootReporting(container, '/shell/detail');

    const [outer, nested] = views(container);
    expect(reports).toEqual([
      [outer, 'adopted'],
      [nested, 'adopted'],
    ]);
    expect(received).toEqual(reports);
  });

  it('reports fell-back with the error for the view drawn for another state', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = serve(await drawShell('/shell/detail'));
    const reports = listen(container);

    const received = await bootReporting(container, '/shell/other');

    const [outer, nested] = views(container);
    expect(reports).toHaveLength(2);
    expect(reports[0]).toEqual([outer, 'adopted']);
    expect(reports[1][0]).toBe(nested);
    expect(reports[1][1]).toBe('fell-back');
    expect(reports[1][2]).toBeInstanceOf(Error);
    expect(received).toEqual(reports);
  });

  it('reports none for a view the document drew empty', async () => {
    const { container } = serve(await drawShell('/shell'));
    const reports = listen(container);

    const received = await bootReporting(container, '/shell/detail');

    const [outer, nested] = views(container);
    expect(reports).toEqual([
      [outer, 'adopted'],
      [nested, 'none'],
    ]);
    expect(received).toEqual(reports);
  });

  it('bubbles out of a shadow root', async () => {
    const { container } = serve(await drawShell('/shell/detail'));
    const host = document.createElement('div');
    document.body.append(host);
    host.attachShadow({ mode: 'open' }).append(container);
    const reports = listen(document);

    await boot(container, rootTemplate, '/shell/detail');

    expect(reports.map(([, outcome]) => outcome)).toEqual([
      'adopted',
      'adopted',
    ]);
  });

  it('reports in production, where the warning is folded away', async () => {
    vi.stubEnv('DEV', false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = serve(await drawShell('/shell/detail'));
    const reports = listen(container);

    await boot(container, rootTemplate, '/shell/other');

    expect(warn).not.toHaveBeenCalled();
    expect(reports.map(([, outcome]) => outcome)).toEqual([
      'adopted',
      'fell-back',
    ]);
  });

  it('reaches onAdopt through the pin after the release', async () => {
    const { container } = serve(await drawShell('/shell'));
    const router = shellRouter();
    await settle(router, '/shell');
    const received: Report[] = [];

    const release = hydrateRoot(container, rootTemplate(router), {
      onAdopt: (view, outcome) => received.push([view, outcome]),
    });
    const app = container.querySelector('ui-router')!;
    const view = app.querySelector<UiView>('ui-view')!;
    app.remove();
    (release as () => void)();
    await view.updateComplete;
    expect(received).toEqual([]);

    container.append(app);
    await drain(container);

    const nested = view.querySelector('ui-view');
    expect(received).toEqual([
      [view, 'adopted'],
      [nested, 'none'],
    ]);
  });

  it('keeps a throwing onAdopt out of the adoption, through reportError', async () => {
    const { container } = serve(await drawShell('/shell'));
    const router = shellRouter();
    await settle(router, '/shell');
    const reports = listen(container);
    const reportError = vi.fn<(error: unknown) => void>();
    vi.stubGlobal('reportError', reportError);
    const failure = new Error('reporter failed');

    const release = hydrateRoot(container, rootTemplate(router), {
      onAdopt: () => {
        throw failure;
      },
    });
    await drain(container);
    (release as () => void)();
    vi.unstubAllGlobals();

    const view = container.querySelector('ui-view')!;
    expect(reports.map(([, outcome]) => outcome)).toEqual(['adopted', 'none']);
    expect(view.querySelector('h1')?.textContent).toContain('shell');
    expect(reportError.mock.calls).toEqual([[failure], [failure]]);
  });

  it('throws a failing onAdopt into the view update without reportError, after adopting', async () => {
    const { container } = serve(await drawShell('/shell'));
    const router = shellRouter();
    await settle(router, '/shell');
    const reports = listen(container);
    vi.stubGlobal('reportError', undefined);
    const failure = new Error('reporter failed');
    let thrown: Promise<unknown> | undefined;

    const release = hydrateRoot(container, rootTemplate(router), {
      onAdopt: (view) => {
        if (thrown) return;
        thrown = (
          view as View & { updateComplete: Promise<boolean> }
        ).updateComplete.then(
          () => undefined,
          (error: unknown) => error,
        );
        throw failure;
      },
    });
    await drain(container);
    (release as () => void)();
    vi.unstubAllGlobals();

    expect(await thrown).toBe(failure);
    const view = container.querySelector('ui-view')!;
    expect(reports[0]?.[1]).toBe('adopted');
    expect(view.querySelector('h1')?.textContent).toContain('shell');
  });

  describe('from the adopter a view requests', () => {
    let container: HTMLElement;
    let release: () => void;

    beforeEach(async () => {
      ({ container } = serve(await drawShell('/shell/detail')));
      ({ release } = await hydrateInto(
        container,
        rootTemplate,
        '/shell/detail',
      ));
      await drain(container);
    });

    afterEach(() => {
      release();
    });

    it('reports none for a view the document served no markers for', () => {
      const view = servedView('<p class="cold">cold</p>', container);
      const reports = listen(view);

      wake(view);

      expect(reports).toEqual([[view, 'none']]);
    });

    it('reports fell-back with the cause for a view whose pair is gone', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const view = servedView(
        '<!--ui-view:lit-part--><p class="detail">leaf</p><!--ui-view:/lit-part-->',
        container,
      );
      const reports = listen(view);

      wake(view);

      expect(reports).toEqual([
        [view, 'fell-back', 'the served part pair is gone'],
      ]);
    });

    it('reports fell-back with what hydrate threw', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const view = servedView(
        '<!--lit-part VIEW--><p>plate</p><!--/lit-part-->',
        container,
      );
      const thrown = new Error('drawn for another state');
      view.render = () => {
        throw thrown;
      };
      const reports = listen(view);

      wake(view);

      expect(reports).toEqual([[view, 'fell-back', thrown]]);
    });
  });
});

describe('the hydration signature', () => {
  const version = import.meta.env.PACKAGE_VERSION;
  const [major, minor] = version.split('.');

  /** The drawn document with its signature's version swapped for `served`. */
  const drawnBy = async (served: string): Promise<string> =>
    (await drawShell('/shell/detail')).replace(
      `"version":"${version}"`,
      `"version":"${served}"`,
    );

  /** A data block as `prerender()` spells it, around arbitrary text. */
  const block = (text: string): string =>
    `<script type="application/json" ${signatureAttribute}>${text}</script>`;

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads the version, the state and its params off the drawn document', async () => {
    const { container } = serve(await drawShell('/shell/detail'));

    expect(readHydrationSignature(container)).toEqual({
      version,
      state: 'shell.detail',
      params: {},
    });
  });

  it('adopts with the block in place ahead of the render, and keeps it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container, served } = serve(await drawShell('/shell/detail'));
    const signature = container.firstElementChild;
    expect(signature?.matches(signatureSelector)).toBe(true);

    await boot(container, rootTemplate, '/shell/detail');

    expect(
      served.filter((element) => container.contains(element)),
    ).toHaveLength(served.length);
    expect(container.querySelector('.detail')?.textContent).toBe('leaf');
    expect(container.firstElementChild).toBe(signature);
    expect(readHydrationSignature(container)?.state).toBe('shell.detail');
    expect(warn).not.toHaveBeenCalled();
  });

  it('reads only the container’s own children', () => {
    const signature = { version, state: 's', params: {} };
    const { container } = serve(`<div>${signatureBlock(signature)}</div>`);

    expect(readHydrationSignature(container)).toBeNull();
  });

  it('brings an awkward param value back through the parser', () => {
    const awkward = `--><script>alert("x")</script><!--&'`;
    const signature = { version, state: 's', params: { q: awkward } };
    const { container } = serve(`${signatureBlock(signature)}<p>page</p>`);

    expect(container.childNodes).toHaveLength(2);
    expect(readHydrationSignature(container)).toEqual(signature);
  });

  it.each([
    ['no signature', '<p>page</p>'],
    ['one that does not parse', block('{"version":')],
    ['one with no version', block('{"state":"s"}')],
    ['one that is not an object', block('null')],
    [
      'a JSON block without the marker',
      `<script type="application/json">{"version":"${version}"}</script>`,
    ],
  ])('reads null off a container holding %s', (_label, markup) => {
    const { container } = serve(markup);

    expect(readHydrationSignature(container)).toBeNull();
  });

  it('leaves a document without one to a cold render, silently', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const markup = withoutSignature(await drawShell('/shell/detail'));
    const { container } = serve(markup);
    expect(container.querySelector('[defer-hydration]')).not.toBeNull();

    expect(hydrateRoot(container, rootTemplate(shellRouter()))).toBe(false);

    expect(container.childNodes).toHaveLength(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it('adopts a document from another patch on the same release line', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container, served } = serve(await drawnBy(`${major}.${minor}.999`));

    await boot(container, rootTemplate, '/shell/detail');

    expect(
      served.filter((element) => container.contains(element)),
    ).toHaveLength(served.length);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ['another minor', `${major}.${Number(minor) + 1}.0`],
    ['another major', `${Number(major) + 1}.${minor}.0`],
  ])(
    'leaves a document from %s to a cold render, naming both versions',
    async (_skew, served) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { container } = serve(await drawnBy(served));

      expect(hydrateRoot(container, rootTemplate(shellRouter()))).toBe(false);

      expect(container.childNodes).toHaveLength(0);
      expect(warn).toHaveBeenCalledOnce();
      const text = warnedText(warn);
      expect(text).toContain('does not adopt');
      expect(text).toContain(served);
      expect(text).toContain(version);
    },
  );

  it('leaves a stripped document cold in production without a word', async () => {
    vi.stubEnv('DEV', false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const markup = stripComments(await drawShell('/shell/detail'));
    const { container } = serve(markup);

    expect(hydrateRoot(container, rootTemplate(shellRouter()))).toBe(false);

    expect(container.childNodes).toHaveLength(0);
    expect(warn).not.toHaveBeenCalled();
  });

  /** Each document hydrateRoot leaves to a cold render, as served. */
  const coldDocuments: [string, () => Promise<string>][] = [
    [
      'no signature',
      async () => withoutSignature(await drawShell('/shell/detail')),
    ],
    ['another release line', () => drawnBy('99.0.0')],
    [
      'stripped markers',
      async () => stripComments(await drawShell('/shell/detail')),
    ],
  ];

  it.each(coldDocuments)(
    'clears a document with %s, so the cold render draws the page once, silently',
    async (_label, markup) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { container } = serve(await markup());
      const router = shellRouter();
      await settle(router, '/shell/detail');

      expect(hydrateRoot(container, rootTemplate(router))).toBe(false);
      expect(container.childNodes).toHaveLength(0);
      render(rootTemplate(router), container);
      await drain(container);

      expect(container.querySelectorAll('ui-router')).toHaveLength(1);
      expect(container.querySelectorAll('.detail')).toHaveLength(1);
      expect(dropped(warn)).toBe(false);
    },
  );

  it.each(coldDocuments)(
    'wakes no served view without an adopter for a document with %s',
    async (_label, markup) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { container } = serve(await markup());
      const served = views(container);

      expect(hydrateRoot(container, rootTemplate(shellRouter()))).toBe(false);
      await Promise.all(
        served.map((view) => (view as unknown as UiView).updateComplete),
      );
      await drain(container);

      expect(dropped(warn)).toBe(false);
    },
  );

  it('clears a document whose walk throws, so the cold render draws the page once, silently', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = serve(await drawShell('/shell/detail'));
    const router = shellRouter();
    await settle(router, '/shell/detail');

    expect(() =>
      hydrateRoot(container, tailRootTemplate(router, 'first')),
    ).toThrow();
    expect(container.childNodes).toHaveLength(0);
    render(tailRootTemplate(router, 'first'), container);
    await drain(container);

    expect(container.querySelectorAll('ui-router')).toHaveLength(1);
    expect(container.querySelectorAll('.detail')).toHaveLength(1);
    expect(dropped(warn)).toBe(false);
  });

  it('leaves a skewed document cold in production without a word', async () => {
    vi.stubEnv('DEV', false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = serve(await drawnBy('99.0.0'));

    expect(hydrateRoot(container, rootTemplate(shellRouter()))).toBe(false);

    expect(warn).not.toHaveBeenCalled();
  });
});
