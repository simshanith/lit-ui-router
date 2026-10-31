import { html } from 'lit';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { Transition } from '@uirouter/core';
import { UIRouterLit } from 'lit-ui-router/pure';
import type {
  LitStateDeclaration,
  RoutedLitTemplate,
  UIRouterLit as Router,
} from 'lit-ui-router/pure';
import { installServerLocation } from 'ui-router-server/location';
import { dehydrate, settle } from 'ui-router-server/ssr';
import type {
  DehydrateResult,
  ResolvePayload,
  Transporter,
} from 'ui-router-server/ssr';
import '../register.js';

import {
  bootstrap,
  readHydrationSignature,
  readResolvePayload,
} from '../client.js';
import type { BootstrapOptions, BootstrapResult } from '../client.js';
import { renderPage } from '../prerender.js';
import { routeOf } from '../signature.js';
import { countRetained } from '../testing.js';
import { UiViewRenderer } from '../ui-view-renderer.js';
import { DetailView, rootTemplate, ShellView } from './fixture.js';
import { serve } from './round-trip.js';

/** A typed resolve, read back after adoption. */
interface Sheet {
  readonly title: string;
  readonly tags: readonly string[];
}

const adoptedSheets: Sheet[] = [];

const SheetView: RoutedLitTemplate<{ sheet: Sheet }> = (props) => {
  const { sheet } = props.resolves;
  expectTypeOf(sheet).toEqualTypeOf<Sheet>();
  adoptedSheets.push(sheet);

  return html`<p class="detail">${sheet.title}</p>`;
};

/** Every resolve function the states run, so a spec can count the calls. */
const resolvers = () => ({
  greeting: vi.fn(() => 'hello'),
  detail: vi.fn(() => 'leaf'),
  when: vi.fn(() => new Date(0)),
  later: vi.fn(() => Promise.resolve('later')),
  sheet: vi.fn((): Sheet => ({ title: 'Plate 7B', tags: ['atlas', 'sheet'] })),
  found: vi.fn(() => 'found'),
});

type Resolvers = ReturnType<typeof resolvers>;

// `deps: []`, since core reads a bare function's dependencies from its source and a mock's spells `...args`.
const counted = <T>(
  token: string,
  resolveFn: () => T,
  policy?: { async: 'NOWAIT' },
) => ({ token, resolveFn, deps: [], policy });

const routerWith = (fns: Resolvers): Router => {
  const router = installServerLocation(new UIRouterLit(), {
    urlConfig: { strict: false },
  });

  const states: LitStateDeclaration[] = [
    {
      name: 'shell',
      url: '/shell',
      component: ShellView,
      resolve: [counted('greeting', fns.greeting)],
    },
    {
      name: 'shell.detail',
      url: '/detail',
      component: DetailView,
      resolve: [counted('detail', fns.detail)],
    },
    {
      name: 'shell.when',
      url: '/when',
      component: DetailView,
      resolve: [counted('detail', fns.detail), counted('when', fns.when)],
    },
    {
      name: 'shell.later',
      url: '/later',
      component: DetailView,
      resolve: [
        counted('detail', fns.detail),
        counted('later', fns.later, { async: 'NOWAIT' }),
      ],
    },
    {
      name: 'search',
      url: '/search/{n:int}?q&{tags:string}',
      params: { tags: { array: true }, mode: 'list' },
      resolve: [counted('found', fns.found)],
    },
  ];

  for (const state of states) router.stateRegistry.register(state);

  const sheet: LitStateDeclaration<{ sheet: Sheet }> = {
    name: 'shell.sheet',
    url: '/sheet',
    component: SheetView,
    resolve: [counted('sheet', fns.sheet)],
  };

  router.stateRegistry.register(sheet);

  return router;
};

/** Draws the document `prerender()` would emit for `path`, its signature carrying what `payload` returns. */
const drawWith = async (
  path: string,
  payload: (transition: Transition) => ResolvePayload | undefined = (
    transition,
  ) => dehydrate(transition).payload,
): Promise<string> => {
  const router = routerWith(resolvers());
  const transition = await settle(router, path);

  return renderPage(
    rootTemplate(router),
    router,
    new EventTarget(),
    [UiViewRenderer],
    payload(transition),
  );
};

/** Serves `markup` and boots a fresh client at `path` into it, counting its resolve calls. */
const bootOver = async (
  markup: string,
  path: string,
  options?: BootstrapOptions,
): Promise<
  BootstrapResult & {
    fns: Resolvers;
    container: HTMLElement;
    kept: boolean;
    router: Router;
  }
> => {
  const { container, stamp } = serve(markup);
  const fns = resolvers();
  const router = routerWith(fns);
  router.urlService.url(path);

  const result = await bootstrap(
    router,
    container,
    rootTemplate(router),
    options,
  );

  const kept = countRetained(stamp).removed === 0;

  return { ...result, fns, container, kept, router };
};

const transport = {
  Date: {
    encode: (value) => value instanceof Date && value.toISOString(),
    // SAFETY: `encode` above answers with an ISO string, the only encoding `decode` gets.
    decode: (encoded) => new Date(encoded as string),
  } satisfies Transporter<Date>,
};

afterEach(() => {
  document.body.replaceChildren();
  adoptedSheets.length = 0;
  vi.restoreAllMocks();
});

describe('the resolves a signature carries', () => {
  it('boot the drawn states with no resolve function called, adopting every served node', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { outcome, signature, fns, kept, container } = await bootOver(
      await drawWith('/shell/detail'),
      '/shell/detail',
    );

    expect({ outcome, signature }).toEqual({
      outcome: 'adopted',
      signature: 'matched',
    });
    expect(fns.greeting).not.toHaveBeenCalled();
    expect(fns.detail).not.toHaveBeenCalled();
    expect(kept).toBe(true);
    expect(container.querySelector('.detail')?.textContent).toBe('leaf');
    expect(warn).not.toHaveBeenCalled();
  });

  it('sit in the one signature block, beside version, state and params', async () => {
    const { container } = serve(await drawWith('/shell/detail'));

    expect(readHydrationSignature(container)).toEqual({
      version: import.meta.env.PACKAGE_VERSION,
      state: 'shell.detail',
      params: {},
      resolves: {
        shell: { greeting: 'hello' },
        'shell.detail': { detail: 'leaf' },
      },
    });
    expect(readResolvePayload(container)).toEqual(
      readHydrationSignature(container),
    );
  });

  it('run every function when the boot lands outside the drawn state', async () => {
    const { signature, fns } = await bootOver(
      await drawWith('/shell/detail'),
      '/shell/when',
    );

    expect(signature).toBe('elsewhere');
    expect(fns.greeting).toHaveBeenCalledOnce();
    expect(fns.detail).toHaveBeenCalledOnce();
    expect(fns.when).toHaveBeenCalledOnce();
  });

  it.each(['/search/8', '/search/7?q=foo'])(
    'run every function when the boot lands on other url parameters, at %s',
    async (path) => {
      const markup = await drawWith('/search/7');
      expect(readResolvePayload(serve(markup).container)?.resolves).toEqual({
        search: { found: 'found' },
      });
      document.body.replaceChildren();

      const { signature, fns } = await bootOver(markup, path);

      expect(signature).toBe('elsewhere');
      expect(fns.found).toHaveBeenCalledOnce();
    },
  );

  it('are absent without a payload hook, so every function runs', async () => {
    const markup = await drawWith('/shell/detail', () => undefined);

    const { outcome, fns, kept, container } = await bootOver(
      markup,
      '/shell/detail',
    );

    expect(readHydrationSignature(serve(markup).container)).not.toHaveProperty(
      'resolves',
    );
    expect(outcome).toBe('adopted');
    expect(fns.greeting).toHaveBeenCalledOnce();
    expect(fns.detail).toHaveBeenCalledOnce();
    expect(kept).toBe(true);
    expect(container.querySelector('.detail')?.textContent).toBe('leaf');
  });

  it('give way to an explicit payload', async () => {
    const { fns } = await bootOver(
      await drawWith('/shell/detail'),
      '/shell/detail',
      { payload: { state: 'shell.detail', params: {}, resolves: {} } },
    );

    expect(fns.greeting).toHaveBeenCalledOnce();
    expect(fns.detail).toHaveBeenCalledOnce();
  });

  it('leave out a value that is not JSON data, which re-runs on the client', async () => {
    let unserializable: DehydrateResult['unserializable'] = [];

    const markup = await drawWith('/shell/when', (transition) => {
      const drawn = dehydrate(transition);
      unserializable = drawn.unserializable;

      return drawn.payload;
    });

    const { outcome, error, fns } = await bootOver(markup, '/shell/when');

    expect(unserializable).toEqual([{ state: 'shell.when', token: 'when' }]);
    expect({ outcome, error }).toEqual({
      outcome: 'adopted',
      error: undefined,
    });
    expect(fns.when).toHaveBeenCalledOnce();
    expect(fns.detail).not.toHaveBeenCalled();
    expect(fns.greeting).not.toHaveBeenCalled();
  });

  it('carry a value a transporter encoded, rebuilt by the same transport on boot', async () => {
    const markup = await drawWith(
      '/shell/when',
      (transition) => dehydrate(transition, { transport }).payload,
    );

    const { outcome, fns, router } = await bootOver(markup, '/shell/when', {
      transport,
    });

    expect(readResolvePayload(serve(markup).container)).toMatchObject({
      resolves: { 'shell.when': { when: '1970-01-01T00:00:00.000Z' } },
      transported: { 'shell.when': { when: [{ type: 'Date', path: [] }] } },
    });
    expect(outcome).toBe('adopted');
    expect(fns.when).not.toHaveBeenCalled();
    expect(
      router.globals.successfulTransitions.peekTail()?.injector().get('when'),
    ).toEqual(new Date(0));
  });

  it("run a transported value's function when bootstrap has no transport", async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const markup = await drawWith(
      '/shell/when',
      (transition) => dehydrate(transition, { transport }).payload,
    );

    const { outcome, fns } = await bootOver(markup, '/shell/when');

    expect(outcome).toBe('adopted');
    expect(fns.when).toHaveBeenCalledOnce();
    expect(fns.detail).not.toHaveBeenCalled();
  });

  it('leave a NOWAIT resolve for the client to run', async () => {
    const markup = await drawWith('/shell/later');
    const { outcome, fns } = await bootOver(markup, '/shell/later');

    expect(readResolvePayload(serve(markup).container)?.resolves).toEqual({
      shell: { greeting: 'hello' },
      'shell.later': { detail: 'leaf' },
    });
    expect(outcome).toBe('adopted');
    expect(fns.later).toHaveBeenCalledOnce();
    expect(fns.detail).not.toHaveBeenCalled();
  });

  it('hand a typed resolve back with its declared shape', async () => {
    const markup = await drawWith('/shell/sheet');
    adoptedSheets.length = 0;

    const { fns, kept } = await bootOver(markup, '/shell/sheet');

    expect(fns.sheet).not.toHaveBeenCalled();
    expect(kept).toBe(true);
    expect(adoptedSheets.at(-1)).toEqual({
      title: 'Plate 7B',
      tags: ['atlas', 'sheet'],
    });
  });
});

describe('the params the signature and the payload each encode', () => {
  it.each([
    '/shell/detail',
    '/search/7',
    '/search/7?q=a%20b',
    '/search/7?tags=x&tags=y',
    '/search/7?tags=x',
  ])('spell %s the same way, key order included', async (path) => {
    const router = routerWith(resolvers());
    const transition = await settle(router, path);
    const { payload } = dehydrate(transition);

    expect(JSON.stringify(routeOf(router.globals))).toBe(
      JSON.stringify([payload.state, payload.params]),
    );
  });
});
