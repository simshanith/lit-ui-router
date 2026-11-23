import { afterEach, describe, expect, it } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

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
