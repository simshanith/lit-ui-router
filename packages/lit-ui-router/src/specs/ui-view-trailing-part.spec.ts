import { afterEach, describe, expect, it } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
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

describe.each([
  {
    kind: '.map()',
    tag: 'mapped-fallback-parent',
    component: MappedFallbackParent,
  },
  {
    kind: 'repeat()',
    tag: 'repeated-fallback-parent',
    component: RepeatedFallbackParent,
  },
] as const)(
  '<ui-view> whose fallback is a $kind list',
  ({ tag, component }) => {
    let cleanup = () => {};

    afterEach(() => cleanup());

    const listStates: LitStateDeclaration[] = [
      { name: 'list', url: '/list', component },
      {
        name: 'list.child',
        url: '/child',
        component: () => html`<p class="child">Child</p>`,
      },
    ];

    const itemTexts = (view: Element) =>
      Array.from(view.querySelectorAll('i'), (i) => i.textContent);

    const mountListParent = async () => {
      const router = createTestRouter(listStates);

      const mounted = await mountElementInRouter(
        document.createElement('ui-view'),
        router,
      );

      cleanup = mounted.cleanup;

      await routerGo(router, 'list');
      await tick(50);

      const parent = mounted.container.querySelector<
        MappedFallbackParent | RepeatedFallbackParent
      >(tag)!;

      return { router, parent, view: parent.querySelector('ui-view')! };
    };

    it('shows every item as the fallback', async () => {
      const { view } = await mountListParent();

      expect(itemTexts(view)).toEqual(['a', 'b']);
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
