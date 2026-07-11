import { describe, it, expect, afterEach, vi } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { comparer, observable, runInAction } from 'mobx';

import { ReactionController } from '../reaction-controller.js';
import { waitForUpdate } from './test-utils.js';

@customElement('reaction-controller-host')
class ReactionControllerHost extends LitElement {
  renderCount = 0;

  render() {
    this.renderCount++;
    return html`<span>${this.renderCount}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'reaction-controller-host': ReactionControllerHost;
  }
}

const cleanups: (() => void)[] = [];

async function mountHost(): Promise<ReactionControllerHost> {
  const host = document.createElement('reaction-controller-host');
  document.body.appendChild(host);
  cleanups.push(() => host.remove());
  await waitForUpdate(host);
  return host;
}

afterEach(() => {
  while (cleanups.length) cleanups.shift()?.();
});

describe('ReactionController', () => {
  it('selects the current value immediately on connect', async () => {
    const state = observable({ count: 7 });
    const host = document.createElement('reaction-controller-host');
    const controller = new ReactionController(host, () => state.count);

    document.body.appendChild(host);
    cleanups.push(() => host.remove());
    await waitForUpdate(host);

    expect(controller.value).toBe(7);
  });

  it('updates the host when the selected value changes', async () => {
    const state = observable({ count: 0 });
    const host = await mountHost();
    const controller = new ReactionController(host, () => state.count);
    await waitForUpdate(host);
    const rendersBefore = host.renderCount;

    runInAction(() => state.count++);
    await waitForUpdate(host);

    expect(controller.value).toBe(1);
    expect(host.renderCount).toBeGreaterThan(rendersBefore);
  });

  it('invokes onChange before the host update', async () => {
    const state = observable({ count: 0 });
    const host = await mountHost();
    const onChange = vi.fn();
    new ReactionController(host, () => state.count, { onChange });
    await waitForUpdate(host);
    onChange.mockClear();

    runInAction(() => state.count++);
    await waitForUpdate(host);

    expect(onChange).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('suppresses structurally equal values with comparer.structural', async () => {
    const state = observable({ count: 0 });
    const host = await mountHost();
    const onChange = vi.fn();
    new ReactionController(host, () => ({ even: state.count % 2 === 0 }), {
      equals: comparer.structural,
      onChange,
    });
    await waitForUpdate(host);
    onChange.mockClear();

    // 0 -> 2: still even; the fresh object is structurally unchanged.
    runInAction(() => (state.count = 2));
    await waitForUpdate(host);
    expect(onChange).not.toHaveBeenCalled();

    runInAction(() => (state.count = 3));
    await waitForUpdate(host);
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ even: false });
  });

  it('disposes the reaction on disconnect', async () => {
    const state = observable({ count: 0 });
    const host = await mountHost();
    const controller = new ReactionController(host, () => state.count);
    await waitForUpdate(host);

    host.remove();
    runInAction(() => state.count++);
    await waitForUpdate(host);

    expect(controller.value).toBe(0);
  });

  it('resynchronizes on reconnect', async () => {
    const state = observable({ count: 0 });
    const host = await mountHost();
    const controller = new ReactionController(host, () => state.count);
    await waitForUpdate(host);

    host.remove();
    runInAction(() => state.count++);
    expect(controller.value).toBe(0);

    document.body.appendChild(host);
    await waitForUpdate(host);

    expect(controller.value).toBe(1);
  });
});
