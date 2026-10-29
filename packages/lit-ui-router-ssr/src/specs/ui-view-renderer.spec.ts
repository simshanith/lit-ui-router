import '../register.js';
import { render } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { html, LitElement, nothing } from 'lit';
import { withRouterSync } from 'lit-ui-router/context';
import { UIRouterLit } from 'lit-ui-router/pure';
import type {
  LitStateDeclaration,
  NormalizedLitViewDeclaration,
  RoutedLitTemplate,
} from 'lit-ui-router/pure';
import * as pure from 'lit-ui-router/pure';
import { installServerLocation } from 'ui-router-server/location';
import { settle } from 'ui-router-server/ssr';
import { describe, expect, it, vi } from 'vitest';

import {
  carriesElement,
  isStickyRenderer,
  UiViewRenderer,
} from '../ui-view-renderer.js';
import type { ClassRendererProbe } from '../ui-view-renderer.js';
import { makeRouter, rootTemplate } from './fixture.js';

const draw = (router: UIRouterLit): string =>
  withRouterSync(router, () =>
    collectResultSync(
      render(rootTemplate(router), {
        elementRenderers: [UiViewRenderer],
      }),
    ),
  );

const at = async (path: string): Promise<string> => {
  const router = makeRouter();
  await settle(router, path);

  return draw(router);
};

/** A view declared as a `RoutedLitElement` class rather than a template function. */
class BoxedView extends LitElement {}

/** One state whose view is a `RoutedLitElement` class, which the renderer has no server render for. */
const boxedRouter = (): UIRouterLit => {
  const router = installServerLocation(new UIRouterLit(), {
    urlConfig: { strict: false },
  });

  const states: LitStateDeclaration[] = [
    { name: 'boxed', url: '/boxed', component: BoxedView },
  ];

  for (const state of states) router.stateRegistry.register(state);

  return router;
};

/** A `sticky` class, which core binds to a renderer in its declaration. */
class StickyView extends LitElement {
  static sticky = true;
}

customElements.define('x-sticky', StickyView);

/** One state whose view is a `sticky` class. */
const stickyRouter = (): UIRouterLit => {
  const router = installServerLocation(new UIRouterLit(), {
    urlConfig: { strict: false },
  });

  const state: LitStateDeclaration = {
    name: 'sticky',
    url: '/sticky',
    component: StickyView,
  };

  router.stateRegistry.register(state);

  return router;
};

/** One state whose NOWAIT resolve never settles, drawn as what its view receives. */
const pendingRouter = (): UIRouterLit => {
  const router = installServerLocation(new UIRouterLit(), {
    urlConfig: { strict: false },
  });

  const state: LitStateDeclaration = {
    name: 'pending',
    url: '/pending',
    resolve: [
      {
        token: 'slow',
        resolveFn: () => new Promise<never>(() => {}),
        policy: { async: 'NOWAIT' },
      },
    ],
    component: (props) =>
      html`<p class="slow">
        ${props.resolves.slow instanceof Promise ? 'promise' : 'missing'}
      </p>`,
  };

  router.stateRegistry.register(state);

  return router;
};

describe('UiViewRenderer', () => {
  it('writes the routed component into the light DOM, never a shadow root', async () => {
    const markup = await at('/shell');

    expect(markup).not.toContain('shadowrootmode');
    expect(markup).not.toContain('<template');
    // the resolve arrives as its own child part inside the component's markup, prefixed with the rest of the interior
    expect(markup).toContain(
      '<h1>shell <!--served:lit-part-->hello<!--served:/lit-part--></h1>',
    );
  });

  it('wraps the component in the part markers its client render hydrates against', async () => {
    const markup = await at('/shell');

    // one plain `lit-part <digest>` opens inside `<ui-view>`, and it closes before the tag does
    expect(markup).toMatch(/<ui-view[^>]*><!--lit-part [^-]+-->/);
    expect(markup).toContain('<!--/lit-part--></ui-view>');
  });

  it('prefixes every marker between that pair, and only those', async () => {
    const markup = await at('/shell/detail');

    const interior = markup.slice(
      markup.indexOf('<!--lit-part HRwFDUbdJU8=-->'),
    );

    // the pair itself is the only plain marker left in the view's own run
    expect(interior.match(/<!--\/?lit-(part|node)/g)).toEqual([
      '<!--lit-part',
      '<!--/lit-part',
      '<!--/lit-part',
      '<!--/lit-part',
    ]);
  });

  it('defers hydration of the view it filled', async () => {
    const markup = await at('/shell');

    expect(markup).toMatch(/<ui-view[^>]*\sdefer-hydration[^>]*>/);
  });

  it('fills the nested view from the child state', async () => {
    const markup = await at('/shell/detail');

    expect(markup).toContain('class="detail"');
    expect(markup).toContain('leaf');
    // outer view, then the inner one the shell template opened
    expect(markup.match(/<ui-view/g)).toHaveLength(2);
    // the nested view's own pair and node marker belong to the parent's run, so they carry the prefix until the parent wakes
    expect(markup).toContain(
      '<!--served:lit-node 0--><ui-view defer-hydration>' +
        '<!--served:lit-part DJeWKgE7tTI=-->' +
        '<p class="detail"><!--served:lit-part-->leaf<!--served:/lit-part--></p>' +
        '<!--served:/lit-part--></ui-view>',
    );
  });

  it('leaves the nested view empty while only the parent state is active', async () => {
    const markup = await at('/shell');

    expect(markup).not.toContain('class="detail"');
    expect(markup).toContain(
      '<ui-view defer-hydration><!--served:lit-part--><!--served:/lit-part--></ui-view>',
    );
  });

  it('renders nothing between the markers for an address no state routes', async () => {
    const markup = await at('/bare');

    // a top-level view: nothing prefixed it, so the empty pair is plain
    expect(markup).toContain(
      '<ui-view defer-hydration><!--lit-part--><!--/lit-part--></ui-view>',
    );
    expect(markup).not.toContain('<h1>');
  });

  it('leaves the view service as it found it', async () => {
    const router = makeRouter();
    await settle(router, '/shell/detail');
    draw(router);
    draw(router);

    expect(router.viewService.available()).toEqual([]);
  });

  it('writes a valued attribute back escaped, quotes included', () => {
    const markup = collectResultSync(
      render(
        html`<ui-view name=${'detail'} data-note=${'Tom & "Jerry"'}></ui-view>`,
        { elementRenderers: [UiViewRenderer] },
      ),
    );

    expect(markup).toContain('name="detail"');
    expect(markup).toContain('data-note="Tom &amp; &quot;Jerry&quot;"');
    // negative control: the raw, unescaped value never reaches the markup
    expect(markup).not.toContain('data-note="Tom & "Jerry""');
  });

  it('leaves a RoutedLitElement view empty and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const router = boxedRouter();
    await settle(router, '/boxed');

    const markup = draw(router);

    expect(markup).toContain(
      '<ui-view defer-hydration><!--lit-part--><!--/lit-part--></ui-view>',
    );
    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'lit-ui-router-ssr: this view is a RoutedLitElement class',
      ),
      '$default',
    );
    warn.mockRestore();
  });

  it('leaves a sticky RoutedLitElement view empty and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const router = stickyRouter();
    await settle(router, '/sticky');

    const markup = draw(router);

    expect(markup).toContain(
      '<ui-view defer-hydration><!--lit-part--><!--/lit-part--></ui-view>',
    );
    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'lit-ui-router-ssr: this view is a RoutedLitElement class',
      ),
      '$default',
    );
    warn.mockRestore();
  });

  it('leaves a RoutedLitElement view empty without a word under node when NODE_ENV is production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const router = boxedRouter();
    await settle(router, '/boxed');

    expect(draw(router)).toContain(
      '<ui-view defer-hydration><!--lit-part--><!--/lit-part--></ui-view>',
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
    vi.unstubAllEnvs();
  });

  it('hands a NOWAIT resolve to the component as its promise, as the client does', async () => {
    const router = pendingRouter();
    await settle(router, '/pending');

    const markup = draw(router);

    expect(markup).toContain('promise');
    expect(markup).not.toContain('missing');
  });
});

describe('sticky class detection', () => {
  /** The `$default` view component core normalized a sticky class to. */
  const stickyComponent = (router: UIRouterLit): RoutedLitTemplate => {
    // SAFETY: a lit state's views are normalized lit view declarations
    const view = router.stateRegistry.get('sticky')?.$$state?.().views
      ?.$default as NormalizedLitViewDeclaration;

    if (pure.isRoutedLitElement(view.component)) {
      throw new Error('core binds a sticky class to a renderer');
    }

    return view.component;
  };

  // The key a core with the class brand stamps on a sticky class's renderer.
  const routedClass: unique symbol = Symbol.for('lit-ui-router#routed-class');

  // A `lit-ui-router` with the brand, as its `pure` namespace reads to this renderer.
  const brandedCore: ClassRendererProbe = {
    isRoutedLitElement: pure.isRoutedLitElement,
    isRoutedClassRenderer: (component) => routedClass in component,
  };

  it('reads the brand without calling the renderer', () => {
    let calls = 0;

    const renderer = Object.assign(
      () => {
        calls++;

        return html`${new StickyView()}`;
      },
      { [routedClass]: StickyView },
    );

    expect(isStickyRenderer(renderer, brandedCore)).toBe(true);
    expect(calls).toBe(0);
  });

  it('falls back to the result shape for a renderer without the brand', () => {
    const router = stickyRouter();
    const component = stickyComponent(router);

    expect(isStickyRenderer(component)).toBe(false);
    expect(isStickyRenderer(component, brandedCore)).toBe(false);
    expect(carriesElement(component({ router, resolves: {} }))).toBe(true);
  });

  it('takes the element followed by nothing as a class result', () => {
    expect(carriesElement(html`${new StickyView()}${nothing}`)).toBe(true);
  });

  it('reads a template component as neither', () => {
    const component = () => html`<p>template</p>`;

    expect(isStickyRenderer(component)).toBe(false);
    expect(carriesElement(component())).toBe(false);
  });
});
