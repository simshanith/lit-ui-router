import '../register.js';
import { render } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { html, LitElement } from 'lit';
import { withRouterSync } from 'lit-ui-router/context';
import { UIRouterLit } from 'lit-ui-router/pure';
import type { LitStateDeclaration } from 'lit-ui-router/pure';
import { installServerLocation } from 'ui-router-server/location';
import { settle } from 'ui-router-server/ssr';
import { describe, expect, it } from 'vitest';

import { UiViewRenderer } from '../ui-view-renderer.js';
import { constructed, makeClassRouter } from './class-fixture.js';
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

/** A `RoutedLitElement` class with no tag, so there is no element to write. */
class UntaggedView extends LitElement {}

/** One state whose view is a class missing from the registry. */
const untaggedRouter = (): UIRouterLit => {
  const router = installServerLocation(new UIRouterLit(), {
    urlConfig: { strict: false },
  });

  const states: LitStateDeclaration[] = [
    { name: 'untagged', url: '/untagged', component: UntaggedView },
  ];

  for (const state of states) router.stateRegistry.register(state);

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

  it('throws for a RoutedLitElement class missing from the registry', async () => {
    const router = untaggedRouter();
    await settle(router, '/untagged');

    expect(() => draw(router)).toThrow(
      'a routed LitElement class must be on the customElements registry to prerender: UntaggedView',
    );
  });

  it('hands a NOWAIT resolve to the component as its promise, as the client does', async () => {
    const router = pendingRouter();
    await settle(router, '/pending');

    const markup = draw(router);

    expect(markup).toContain('promise');
    expect(markup).not.toContain('missing');
  });
});

describe('UiViewRenderer, for a routed LitElement class', () => {
  const classAt = async (path: string): Promise<string> => {
    const router = makeClassRouter();
    await settle(router, path);

    return draw(router);
  };

  it('writes the element into the first of the two slots core renders a class into', async () => {
    const markup = await classAt('/card');

    // `BRUAAAUVAAA=` digests any all-empty strings, so the part count is what matches core's `${slots[0]}${slots[1]}`
    expect(markup).toContain(
      '<ui-view defer-hydration><!--lit-part BRUAAAUVAAA=-->' +
        '<!--served:lit-part--><routed-card defer-hydration>',
    );
    expect(markup).toContain(
      '</routed-card><!--served:/lit-part-->' +
        '<!--served:lit-part--><!--served:/lit-part--><?><!--/lit-part--></ui-view>',
    );
  });

  it('renders the element’s shadow root from the props core assigned', async () => {
    const markup = await classAt('/card');

    expect(markup).toContain(
      '<template shadowroot="open" shadowrootmode="open">',
    );
    expect(markup).toContain(
      '<p class="card"><!--served:lit-part-->card leaf<!--served:/lit-part--></p>',
    );
    expect(markup).not.toContain('unrouted');
  });

  it('writes no node marker inside the slot, since the client reads the element as a leaf value', async () => {
    const markup = await classAt('/card');
    const slot = markup.slice(markup.indexOf('BRUAAAUVAAA='));

    expect(slot).not.toMatch(/lit-node/);
  });

  it('builds the element through core, props in the constructor', async () => {
    constructed.length = 0;
    await classAt('/card');

    expect(constructed[0]?.resolves).toMatchObject({ detail: 'card leaf' });
    // `LitElementRenderer` constructs its own instance with no arguments before the renderer seats core's
    expect(constructed[1]).toBeUndefined();
  });

  it('writes a sticky class as its element rather than as text', async () => {
    const markup = await classAt('/sticky');

    expect(markup).toContain('<sticky-card defer-hydration>');
    expect(markup).toContain('sticky leaf');
    expect(markup).not.toContain('&lt;');
    expect(markup).not.toContain('[object');
  });

  it('writes a light-DOM class as its bare element, with no shadow root to hide its render', async () => {
    const markup = await classAt('/light');

    expect(markup).toContain(
      '<!--served:lit-part--><light-card defer-hydration></light-card><!--served:/lit-part-->',
    );
    expect(markup).not.toContain('shadowroot');
  });

  it('leaves the view service as it found it', async () => {
    const router = makeClassRouter();
    await settle(router, '/card');
    draw(router);

    expect(router.viewService.available()).toEqual([]);
  });
});
