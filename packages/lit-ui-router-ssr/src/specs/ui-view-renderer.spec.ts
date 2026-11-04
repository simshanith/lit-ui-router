import '../register.js';
import { render } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import {
  childNodes,
  comments,
  element,
  elements,
  getAttribute,
  hasAttribute,
  lightChildren,
  outline,
  parseMarkup,
  shadowRoot,
  outlineTree,
  text,
} from '@tools/lit-test-env/ssr-tree.ts';
import type {
  DocumentFragment,
  Element,
} from '@tools/lit-test-env/ssr-tree.ts';
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

/** The labels of the nodes either side of `node`, as {@link outline} writes them. */
const around = (node: Element): (string | undefined)[] => {
  const parent = node.parentNode;

  if (!parent) return [];
  const labels = outline(parent);
  const at = childNodes(parent).indexOf(node);

  return [labels[at - 1], labels[at + 1]];
};

/** Comment data from the comment `first` on, in document order. */
const commentsFrom = (tree: DocumentFragment, first: string): string[] => {
  const all = comments(tree);

  expect(all).toContain(first);

  return all.slice(all.indexOf(first));
};

const deferred = [{ name: 'defer-hydration', value: '' }];

describe('UiViewRenderer', () => {
  it('writes the routed component into the light DOM, never a shadow root', async () => {
    const tree = parseMarkup(await at('/shell'));

    expect(elements(tree, 'template')).toEqual([]);
    // the resolve arrives as its own child part inside the component's markup, prefixed with the rest of the interior
    expect(outline(element(tree, 'h1'))).toEqual([
      'shell ',
      '<!--served:lit-part-->',
      'hello',
      '<!--served:/lit-part-->',
    ]);
  });

  it('wraps the component in the part markers its client render hydrates against', async () => {
    const view = element(parseMarkup(await at('/shell')), 'ui-view');
    const children = outline(view);

    // one plain `lit-part <digest>` opens inside `<ui-view>`, and it closes before the tag does
    expect(children[0]).toMatch(/^<!--lit-part [^-]+-->$/);
    expect(children.at(-1)).toBe('<!--/lit-part-->');
  });

  it('prefixes every marker between that pair, and only those', async () => {
    const interior = commentsFrom(
      parseMarkup(await at('/shell/detail')),
      'lit-part HRwFDUbdJU8=',
    );

    // the pair itself is the only plain marker left in the view's own run
    expect(interior.filter((data) => /^\/?lit-(part|node)/.test(data))).toEqual(
      ['lit-part HRwFDUbdJU8=', '/lit-part', '/lit-part', '/lit-part'],
    );
  });

  it('defers hydration of the view it filled', async () => {
    const view = element(parseMarkup(await at('/shell')), 'ui-view');

    expect(hasAttribute(view, 'defer-hydration')).toBe(true);
  });

  it('fills the nested view from the child state', async () => {
    const view = element(parseMarkup(await at('/shell/detail')), 'ui-view');

    // the nested view's own pair and node marker belong to the parent's run, so they carry the prefix until the parent wakes
    expect(outlineTree(view)).toEqual([
      '{open HRwFDUbdJU8=}',
      '<h1>',
      '  "shell"',
      '  served:{open}',
      '  "hello"',
      '  served:{close}',
      'served:{open R3pk4ojRUyo=}',
      'served:{node 0}',
      '<ui-view defer-hydration>',
      '  served:{open DJeWKgE7tTI=}',
      '  <p class="detail">',
      '    served:{open}',
      '    "leaf"',
      '    served:{close}',
      '  served:{close}',
      'served:{close}',
      '{close}',
    ]);
  });

  it('leaves the nested view empty while only the parent state is active', async () => {
    const tree = parseMarkup(await at('/shell'));
    const [, inner] = elements(tree, 'ui-view');

    expect(elements(tree, 'p', { class: 'detail' })).toEqual([]);
    expect(inner.attrs).toEqual(deferred);
    expect(outline(inner)).toEqual([
      '<!--served:lit-part-->',
      '<!--served:/lit-part-->',
    ]);
  });

  it('renders nothing between the markers for an address no state routes', async () => {
    const tree = parseMarkup(await at('/bare'));
    const view = element(tree, 'ui-view');

    // a top-level view: nothing prefixed it, so the empty pair is plain
    expect(view.attrs).toEqual(deferred);
    expect(outline(view)).toEqual(['<!--lit-part-->', '<!--/lit-part-->']);
    expect(elements(tree, 'h1')).toEqual([]);
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

    expect(element(parseMarkup(markup), 'ui-view').attrs).toEqual([
      { name: 'name', value: 'detail' },
      { name: 'data-note', value: 'Tom & "Jerry"' },
    ]);
    // escaping is a property of the bytes, which the parsed value above can't show
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

    const slow = element(parseMarkup(draw(router)), 'p', { class: 'slow' });

    expect(text(slow).trim()).toBe('promise');
  });
});

describe('UiViewRenderer, for a routed LitElement class', () => {
  const classAt = async (path: string): Promise<DocumentFragment> => {
    const router = makeClassRouter();
    await settle(router, path);

    return parseMarkup(draw(router));
  };

  it('writes the element into the first of the two slots core renders a class into', async () => {
    const view = element(await classAt('/card'), 'ui-view');

    expect(view.attrs).toEqual(deferred);
    // `BRUAAAUVAAA=` digests any all-empty strings, so the part count is what matches core's `${slots[0]}${slots[1]}`
    expect(outlineTree(view)).toEqual([
      '{open BRUAAAUVAAA=}',
      'served:{open}',
      '<routed-card defer-hydration>',
      '  #shadow open',
      '    served:{open ZE6GZYxmlAk=}',
      '    <p class="card">',
      '      served:{open}',
      '      "card leaf"',
      '      served:{close}',
      '    served:{close}',
      'served:{close}',
      'served:{open}',
      'served:{close}',
      '<!--?-->',
      '{close}',
    ]);
  });

  it('renders the element’s shadow root from the props core assigned', async () => {
    const tree = await classAt('/card');
    const card = element(tree, 'routed-card');

    expect(lightChildren(card)).toEqual([]);
    expect(text(element(shadowRoot(card), 'p', { class: 'card' }))).toBe(
      'card leaf',
    );
    // lit also writes the pre-standard attribute beside shadowrootmode
    expect(getAttribute(element(card, 'template'), 'shadowroot')).toBe('open');
    expect(elements(tree, 'span', { class: 'unrouted' })).toEqual([]);
  });

  it('writes no node marker inside the slot, since the client reads the element as a leaf value', async () => {
    const slot = commentsFrom(await classAt('/card'), 'lit-part BRUAAAUVAAA=');

    expect(slot.filter((data) => data.includes('lit-node'))).toEqual([]);
  });

  it('builds the element through core, props in the constructor', async () => {
    constructed.length = 0;
    await classAt('/card');

    expect(constructed[0]?.resolves).toMatchObject({ detail: 'card leaf' });
    // `LitElementRenderer` constructs its own instance with no arguments before the renderer seats core's
    expect(constructed[1]).toBeUndefined();
  });

  it('writes a sticky class as its element rather than as text', async () => {
    const tree = await classAt('/sticky');
    const card = element(tree, 'sticky-card');

    expect(card.attrs).toEqual(deferred);
    expect(text(card)).toContain('sticky leaf');
    expect(text(tree)).not.toContain('<');
    expect(text(tree)).not.toContain('[object');
  });

  it('writes a light-DOM class as its bare element, with no shadow root to hide its render', async () => {
    const tree = await classAt('/light');
    const card = element(tree, 'light-class-card');

    expect(card.attrs).toEqual(deferred);
    expect(outline(card)).toEqual([]);
    expect(around(card)).toEqual([
      '<!--served:lit-part-->',
      '<!--served:/lit-part-->',
    ]);
    expect(() => shadowRoot(card)).toThrow('has no shadow root');
    expect(elements(tree, 'template')).toEqual([]);
  });

  it('leaves the view service as it found it', async () => {
    const router = makeClassRouter();
    await settle(router, '/card');
    draw(router);

    expect(router.viewService.available()).toEqual([]);
  });
});
