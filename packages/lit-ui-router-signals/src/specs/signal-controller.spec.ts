import { describe, it, expect, afterEach, vi } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { Signal } from 'signal-polyfill';

import { SignalController } from '../signal-controller.js';
import { waitForUpdate } from './test-utils.js';

@customElement('signal-controller-host')
class SignalControllerHost extends LitElement {
  renderCount = 0;

  render() {
    this.renderCount++;

    return html`<span>${this.renderCount}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'signal-controller-host': SignalControllerHost;
  }
}

const sameParity = (a: { even: boolean }, b: { even: boolean }) =>
  a.even === b.even;

const cleanups: (() => void)[] = [];

async function mountHost(): Promise<SignalControllerHost> {
  const host = document.createElement('signal-controller-host');
  document.body.appendChild(host);
  cleanups.push(() => host.remove());
  await waitForUpdate(host);

  return host;
}

/** Lets the controller's microtask delivery and the host update settle. */
async function settle(host: SignalControllerHost): Promise<void> {
  await Promise.resolve();
  await waitForUpdate(host);
}

afterEach(() => {
  while (cleanups.length) cleanups.shift()?.();
});

describe('SignalController', () => {
  it('selects the current value immediately on connect', async () => {
    const count = new Signal.State(7);
    const host = document.createElement('signal-controller-host');
    const controller = new SignalController(host, () => count.get());

    document.body.appendChild(host);
    cleanups.push(() => host.remove());

    expect(controller.value).toBe(7);
    await waitForUpdate(host);
  });

  it('exposes initialValue before the host connects', async () => {
    const count = new Signal.State(7);
    const host = document.createElement('signal-controller-host');

    const controller = new SignalController(host, () => count.get(), {
      initialValue: 0,
    });

    expect(controller.value).toBe(0);

    document.body.appendChild(host);
    cleanups.push(() => host.remove());
    await waitForUpdate(host);

    expect(controller.value).toBe(7);
  });

  it('updates the host when the selected value changes', async () => {
    const count = new Signal.State(0);
    const host = await mountHost();
    const controller = new SignalController(host, () => count.get());
    await waitForUpdate(host);
    const rendersBefore = host.renderCount;

    count.set(1);
    await settle(host);

    expect(controller.value).toBe(1);
    expect(host.renderCount).toBeGreaterThan(rendersBefore);
  });

  it('delivers several synchronous sets as one change', async () => {
    const count = new Signal.State(0);
    const host = await mountHost();
    const onChange = vi.fn();
    new SignalController(host, () => count.get(), { onChange });
    await waitForUpdate(host);
    onChange.mockClear();

    count.set(1);
    count.set(2);
    count.set(3);
    await settle(host);

    expect(onChange).toHaveBeenCalledExactlyOnceWith(3);
  });

  it('invokes onChange before the host update', async () => {
    const count = new Signal.State(0);
    const host = await mountHost();
    const order: string[] = [];
    const onChange = vi.fn(() => order.push('change'));
    new SignalController(host, () => count.get(), { onChange });
    await waitForUpdate(host);
    onChange.mockClear();
    host.addController({ hostUpdate: () => order.push('update') });
    order.length = 0;

    count.set(1);
    await settle(host);

    expect(onChange).toHaveBeenCalledExactlyOnceWith(1);
    expect(order).toEqual(['change', 'update']);
  });

  it('suppresses values the equals comparer judges unchanged', async () => {
    const count = new Signal.State(0);
    const host = await mountHost();
    const onChange = vi.fn();
    new SignalController(host, () => ({ even: count.get() % 2 === 0 }), {
      equals: sameParity,
      onChange,
    });
    await waitForUpdate(host);
    onChange.mockClear();

    // 0 -> 2: still even; the fresh object compares equal.
    count.set(2);
    await settle(host);
    expect(onChange).not.toHaveBeenCalled();

    count.set(3);
    await settle(host);
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ even: false });
  });

  it('stops watching on disconnect', async () => {
    const count = new Signal.State(0);
    const host = await mountHost();
    const controller = new SignalController(host, () => count.get());
    await waitForUpdate(host);

    host.remove();
    count.set(1);
    await settle(host);

    expect(controller.value).toBe(0);
  });

  it('drops a change already queued when the host disconnects', async () => {
    const count = new Signal.State(0);
    const host = await mountHost();
    const onChange = vi.fn();
    new SignalController(host, () => count.get(), { onChange });
    await waitForUpdate(host);
    onChange.mockClear();

    count.set(1);
    host.remove();
    await settle(host);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('resynchronizes on reconnect', async () => {
    const count = new Signal.State(0);
    const host = await mountHost();
    const controller = new SignalController(host, () => count.get());
    await waitForUpdate(host);

    host.remove();
    count.set(1);
    expect(controller.value).toBe(0);

    document.body.appendChild(host);
    await waitForUpdate(host);

    expect(controller.value).toBe(1);
  });
});
