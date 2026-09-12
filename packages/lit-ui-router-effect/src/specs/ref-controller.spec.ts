import { describe, it, expect, afterEach, vi } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import {
  Data,
  Effect,
  Equal,
  Layer,
  ManagedRuntime,
  SubscriptionRef,
} from 'effect';

import { RefController } from '../ref-controller.js';
import { waitForUpdate } from './test-utils.js';

@customElement('ref-controller-host')
class RefControllerHost extends LitElement {
  renderCount = 0;

  render() {
    this.renderCount++;
    return html`<span>${this.renderCount}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ref-controller-host': RefControllerHost;
  }
}

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.shift()?.();
});

const makeRef = <T>(value: T) => Effect.runSync(SubscriptionRef.make(value));
const set = <T>(ref: SubscriptionRef.SubscriptionRef<T>, value: T) =>
  Effect.runSync(SubscriptionRef.set(ref, value));

function createHost(): RefControllerHost {
  return document.createElement('ref-controller-host');
}

async function mount(host: RefControllerHost): Promise<void> {
  document.body.appendChild(host);
  cleanups.push(() => host.remove());
  await waitForUpdate(host);
}

describe('RefController', () => {
  it('reads refs given directly at construction, before the host connects', () => {
    const count = makeRef(7);
    const controller = new RefController(createHost(), [count], (n) => n * 2);

    expect(controller.value).toBe(14);
  });

  it('carries initialValue until a ref thunk resolves on connect', async () => {
    const count = makeRef(7);
    const host = createHost();
    const controller = new RefController(
      host,
      () => [count],
      (n) => n,
      {
        initialValue: 0,
      },
    );

    expect(controller.value).toBe(0);

    await mount(host);

    expect(controller.value).toBe(7);
  });

  it('stays idle while the thunk returns nothing', async () => {
    const host = createHost();
    const onChange = vi.fn();
    const controller = new RefController(
      host,
      () => undefined,
      (n) => n,
      {
        initialValue: 'none',
        onChange,
      },
    );

    await mount(host);

    expect(controller.value).toBe('none');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('updates the host when the selected value changes', async () => {
    const count = makeRef(0);
    const host = createHost();
    const controller = new RefController(host, [count], (n) => n);
    await mount(host);
    const rendersBefore = host.renderCount;

    set(count, 1);
    await waitForUpdate(host);

    expect(controller.value).toBe(1);
    expect(host.renderCount).toBeGreaterThan(rendersBefore);
  });

  it('selects across several refs', async () => {
    const first = makeRef('a');
    const second = makeRef(1);
    const host = createHost();
    const controller = new RefController(
      host,
      [first, second],
      (s, n) => `${s}${n}`,
    );
    await mount(host);

    expect(controller.value).toBe('a1');

    set(second, 2);
    await waitForUpdate(host);
    expect(controller.value).toBe('a2');

    set(first, 'b');
    await waitForUpdate(host);
    expect(controller.value).toBe('b2');
  });

  it('skips the update when equals says the selection is unchanged', async () => {
    const point = makeRef({ x: 1, y: 2 });
    const host = createHost();
    const onChange = vi.fn();
    new RefController(host, [point], (p) => Data.struct({ x: p.x }), {
      equals: Equal.equals,
      onChange,
    });
    await mount(host);
    const rendersBefore = host.renderCount;
    expect(onChange).toHaveBeenCalledTimes(1);

    set(point, { x: 1, y: 3 });
    await waitForUpdate(host);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(host.renderCount).toBe(rendersBefore);

    set(point, { x: 2, y: 3 });
    await waitForUpdate(host);

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(host.renderCount).toBeGreaterThan(rendersBefore);
  });

  it('fires onChange on connect, on change, and again on reconnect', async () => {
    const count = makeRef(1);
    const host = createHost();
    const onChange = vi.fn();
    new RefController(host, [count], (n) => n, { onChange });

    expect(onChange).not.toHaveBeenCalled();

    await mount(host);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(1);

    set(count, 2);
    await waitForUpdate(host);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(2);

    host.remove();
    document.body.appendChild(host);
    await waitForUpdate(host);
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenLastCalledWith(2);
  });

  it('stops following on disconnect and resynchronizes on reconnect', async () => {
    const count = makeRef(1);
    const host = createHost();
    const controller = new RefController(host, [count], (n) => n);
    await mount(host);

    host.remove();
    set(count, 2);
    await waitForUpdate(host);
    expect(controller.value).toBe(1);

    document.body.appendChild(host);
    await waitForUpdate(host);
    expect(controller.value).toBe(2);
  });

  it('forks the subscription on the runtime it is given', async () => {
    const runtime = ManagedRuntime.make(Layer.empty);
    cleanups.push(() => void runtime.dispose());
    const runFork = vi.spyOn(runtime, 'runFork');
    const count = makeRef(1);
    const host = createHost();
    const controller = new RefController(host, [count], (n) => n, { runtime });
    await mount(host);

    expect(runFork).toHaveBeenCalledTimes(1);

    set(count, 2);
    await waitForUpdate(host);
    expect(controller.value).toBe(2);

    host.remove();
    // the interrupt is forked on the same runtime
    expect(runFork).toHaveBeenCalledTimes(2);
  });
});
