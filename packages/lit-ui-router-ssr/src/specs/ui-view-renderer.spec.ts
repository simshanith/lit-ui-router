import 'lit-ui-router/register';
import { render } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { withRouterSync } from 'lit-ui-router/context';
import type { UIRouterLit } from 'lit-ui-router/pure';
import { describe, expect, it } from 'vitest';

import { UiViewRenderer } from '../ui-view-renderer.js';
import { goTo, makeRouter, rootTemplate } from './fixture.js';

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
  await goTo(router, path);
  return draw(router);
};

describe('UiViewRenderer', () => {
  it('writes the routed component into the light DOM, never a shadow root', async () => {
    const markup = await at('/shell');

    expect(markup).not.toContain('shadowrootmode');
    expect(markup).not.toContain('<template');
    // the resolve arrives as its own child part inside the component's markup, prefixed with the rest of the interior
    expect(markup).toContain(
      '<h1>shell <!--ui-view:lit-part-->hello<!--ui-view:/lit-part--></h1>',
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
      '<!--ui-view:lit-node 0--><ui-view defer-hydration>' +
        '<!--ui-view:lit-part DJeWKgE7tTI=-->' +
        '<p class="detail"><!--ui-view:lit-part-->leaf<!--ui-view:/lit-part--></p>' +
        '<!--ui-view:/lit-part--></ui-view>',
    );
  });

  it('leaves the nested view empty while only the parent state is active', async () => {
    const markup = await at('/shell');

    expect(markup).not.toContain('class="detail"');
    expect(markup).toContain(
      '<ui-view defer-hydration><!--ui-view:lit-part--><!--ui-view:/lit-part--></ui-view>',
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
    await goTo(router, '/shell/detail');
    draw(router);
    draw(router);

    expect(router.viewService.available()).toEqual([]);
  });
});
