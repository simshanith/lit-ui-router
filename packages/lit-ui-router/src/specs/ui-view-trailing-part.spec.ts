import { afterEach, describe, expect, it } from 'vitest';
import { html, LitElement, render } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { cache } from 'lit/directives/cache.js';
import { repeat } from 'lit/directives/repeat.js';

import '../ui-view.register.js';
import type { LitStateDeclaration } from '../interface.js';
import {
  createTestRouter,
  mountElementInRouter,
  routerGo,
  tick,
} from './test-utils.js';

@customElement('trailing-part-parent')
class TrailingPartParent extends LitElement {
  @state() ready = false;

  createRenderRoot() {
    return this;
  }

  render() {
    return html`<ui-view
      >${
        this.ready
          ? html`<em class="hint">Pick a child</em>`
          : html`<p class="hint">Loading</p>`
      }</ui-view
    >`;
  }
}

const states: LitStateDeclaration[] = [
  { name: 'parent', url: '/parent', component: TrailingPartParent },
  {
    name: 'parent.child',
    url: '/child',
    component: () => html`<p class="child">Child</p>`,
  },
];

describe('<ui-view> whose fallback is a trailing part of the parent template', () => {
  let cleanup = () => {};

  afterEach(() => cleanup());

  const mountReadyParent = async () => {
    const router = createTestRouter(states);

    const mounted = await mountElementInRouter(
      document.createElement('ui-view'),
      router,
    );

    cleanup = mounted.cleanup;

    await routerGo(router, 'parent');
    await tick(50);

    const parent = mounted.container.querySelector<TrailingPartParent>(
      'trailing-part-parent',
    )!;

    const view = parent.querySelector('ui-view')!;

    parent.ready = true;
    await parent.updateComplete;

    return { router, view };
  };

  it('renders a child state after the parent swaps the fallback template', async () => {
    const { router, view } = await mountReadyParent();
    expect(view.querySelector('.hint')?.textContent).toBe('Pick a child');

    await routerGo(router, 'parent.child');
    await tick(50);

    expect(view.querySelector('p.child')?.textContent).toBe('Child');
    expect(view.querySelector('.hint')).toBeNull();
  });

  it('shows the swapped fallback again when the child state exits', async () => {
    const { router, view } = await mountReadyParent();

    await routerGo(router, 'parent.child');
    await tick(50);
    await routerGo(router, 'parent');
    await tick(50);

    expect(view.querySelector('p.child')).toBeNull();
    expect(view.querySelectorAll('.hint')).toHaveLength(1);
    expect(view.querySelector('.hint')?.textContent).toBe('Pick a child');
  });
});

@customElement('mapped-fallback-parent')
class MappedFallbackParent extends LitElement {
  @state() items = ['a', 'b'];

  createRenderRoot() {
    return this;
  }

  render() {
    return html`<ui-view>${this.items.map((i) => html`<i>${i}</i>`)}</ui-view>`;
  }
}

@customElement('repeated-fallback-parent')
class RepeatedFallbackParent extends LitElement {
  @state() items = ['a', 'b'];

  createRenderRoot() {
    return this;
  }

  render() {
    return html`<ui-view
      >${repeat(
        this.items,
        (i) => i,
        (i) => html`<i>${i}</i>`,
      )}</ui-view
    >`;
  }
}

@customElement('cached-fallback-parent')
class CachedFallbackParent extends LitElement {
  @state() items = ['a', 'b'];

  createRenderRoot() {
    return this;
  }

  render() {
    return html`<ui-view
      >${cache(html`${this.items.map((i) => html`<i>${i}</i>`)}`)}</ui-view
    >`;
  }
}

@customElement('mapped-tail-fallback-parent')
class MappedTailFallbackParent extends LitElement {
  @state() items = ['a', 'b'];

  createRenderRoot() {
    return this;
  }

  render() {
    return html`<ui-view
      >${this.items.map((i) => html`<i>${i}</i>`)}<b>tail</b></ui-view
    >`;
  }
}

@customElement('repeated-tail-fallback-parent')
class RepeatedTailFallbackParent extends LitElement {
  @state() items = ['a', 'b'];

  createRenderRoot() {
    return this;
  }

  render() {
    return html`<ui-view
      >${repeat(
        this.items,
        (i) => i,
        (i) => html`<i>${i}</i>`,
      )}<b>tail</b></ui-view
    >`;
  }
}

type ListParent =
  | MappedFallbackParent
  | RepeatedFallbackParent
  | CachedFallbackParent
  | MappedTailFallbackParent
  | RepeatedTailFallbackParent;

describe.each([
  {
    kind: '.map()',
    tag: 'mapped-fallback-parent',
    component: MappedFallbackParent,
    tail: [],
  },
  {
    kind: 'repeat()',
    tag: 'repeated-fallback-parent',
    component: RepeatedFallbackParent,
    tail: [],
  },
  {
    kind: 'cache()',
    tag: 'cached-fallback-parent',
    component: CachedFallbackParent,
    tail: [],
  },
  {
    kind: '.map() and trailing sibling',
    tag: 'mapped-tail-fallback-parent',
    component: MappedTailFallbackParent,
    tail: ['tail'],
  },
  {
    kind: 'repeat() and trailing sibling',
    tag: 'repeated-tail-fallback-parent',
    component: RepeatedTailFallbackParent,
    tail: ['tail'],
  },
] as const)(
  '<ui-view> whose fallback is a $kind list',
  ({ tag, component, tail }) => {
    let cleanup = () => {};

    afterEach(() => cleanup());

    const listStates: LitStateDeclaration[] = [
      { name: 'list', url: '/list', component },
      {
        name: 'list.child',
        url: '/child',
        component: () => html`<p class="child">Child</p>`,
      },
      {
        name: 'list.text',
        url: '/text',
        component: () => html`Text`,
      },
    ];

    const itemTexts = (view: Element) =>
      Array.from(view.querySelectorAll('i'), (i) => i.textContent);

    const tailTexts = (view: Element) =>
      Array.from(view.querySelectorAll('b'), (b) => b.textContent);

    const mountListParent = async (first = 'list') => {
      const router = createTestRouter(listStates);

      const mounted = await mountElementInRouter(
        document.createElement('ui-view'),
        router,
      );

      cleanup = mounted.cleanup;

      await routerGo(router, first);
      await tick(50);

      const parent = mounted.container.querySelector<ListParent>(tag)!;

      return { router, parent, view: parent.querySelector('ui-view')! };
    };

    it('shows every item as the fallback', async () => {
      const { view } = await mountListParent();

      expect(itemTexts(view)).toEqual(['a', 'b']);
      expect(tailTexts(view)).toEqual(tail);
    });

    it('hides every item when it first mounts on a child state', async () => {
      const { view } = await mountListParent('list.child');

      expect(itemTexts(view)).toEqual([]);
      expect(tailTexts(view)).toEqual([]);
      expect(view.querySelector('p.child')?.textContent).toBe('Child');
    });

    it('shows a list changed while parked from its first mount', async () => {
      const { router, parent, view } = await mountListParent('list.child');

      parent.items = ['c', 'a', 'd'];
      await parent.updateComplete;

      expect(itemTexts(view)).toEqual([]);

      await routerGo(router, 'list');
      await tick(50);

      expect(view.querySelector('p.child')).toBeNull();
      expect(itemTexts(view)).toEqual(['c', 'a', 'd']);
      expect(tailTexts(view)).toEqual(tail);
    });

    it('shows a list emptied while parked from its first mount', async () => {
      const { router, parent, view } = await mountListParent('list.child');

      parent.items = [];
      await parent.updateComplete;
      await routerGo(router, 'list');
      await tick(50);

      expect(itemTexts(view)).toEqual([]);
      expect(tailTexts(view)).toEqual(tail);
    });

    it('marks no element routed when it first mounts on a text-only child', async () => {
      const { view } = await mountListParent('list.text');

      expect(view.textContent).toBe('Text');
      expect(view.routedElement).toBeNull();
      expect(view.querySelector('[routed]')).toBeNull();
    });

    it('hides every item while a child state is active', async () => {
      const { router, view } = await mountListParent();

      await routerGo(router, 'list.child');
      await tick(50);

      expect(itemTexts(view)).toEqual([]);
      expect(view.querySelector('p.child')?.textContent).toBe('Child');
    });

    it('keeps a changed list hidden while a child state is active', async () => {
      const { router, parent, view } = await mountListParent();

      await routerGo(router, 'list.child');
      await tick(50);

      parent.items = ['c', 'a', 'd'];
      await parent.updateComplete;

      expect(itemTexts(view)).toEqual([]);
      expect(view.querySelector('p.child')?.textContent).toBe('Child');
    });

    it('shows the changed list in order when the child state exits', async () => {
      const { router, parent, view } = await mountListParent();

      await routerGo(router, 'list.child');
      await tick(50);

      parent.items = ['c', 'a', 'd'];
      await parent.updateComplete;

      await routerGo(router, 'list');
      await tick(50);

      expect(view.querySelector('p.child')).toBeNull();
      expect(itemTexts(view)).toEqual(['c', 'a', 'd']);
    });
  },
);

describe.each([
  {
    kind: '.map()',
    items: (items: string[]) => items.map((i) => html`<i>${i}</i>`),
  },
  {
    kind: 'repeat()',
    items: (items: string[]) =>
      repeat(
        items,
        (i) => i,
        (i) => html`<i>${i}</i>`,
      ),
  },
])(
  '<ui-view> whose $kind fallback re-renders before its first update',
  ({ items }) => {
    let cleanup = () => {};

    afterEach(() => cleanup());

    const template = (list: string[]) =>
      html`<ui-view>${items(list)}<b>tail</b></ui-view>`;

    it('shows the latest list and its trailing sibling', async () => {
      const router = createTestRouter([]);
      const host = document.createElement('div');
      const mounted = await mountElementInRouter(host, router);
      cleanup = mounted.cleanup;

      render(template(['a', 'b']), host);
      render(template(['b', 'a', 'c']), host);

      const view = host.querySelector('ui-view')!;
      await view.updateComplete;

      expect(
        Array.from(view.querySelectorAll('i'), (i) => i.textContent),
      ).toEqual(['b', 'a', 'c']);
      expect(view.querySelectorAll('b')).toHaveLength(1);
    });
  },
);
