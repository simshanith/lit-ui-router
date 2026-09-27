import { noChange } from 'lit';
import { UiView } from 'lit-ui-router/pure';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withServedRender } from '../served-view.js';
import type { ServedUiView } from '../served-view.js';

// The entry defines its tags when the module evaluates, so each case gets a
// fresh module graph and a registry of its own to define them into.
const stubRegistry = (): Map<string, CustomElementConstructor> => {
  const defined = new Map<string, CustomElementConstructor>();
  vi.stubGlobal('customElements', {
    get: (name: string): CustomElementConstructor | undefined =>
      defined.get(name),
    define: (name: string, constructor: CustomElementConstructor): void => {
      if (defined.has(name)) throw new Error(`already defined: ${name}`);
      defined.set(name, constructor);
    },
  });
  return defined;
};

/** Evaluates the entry against the current registry, from a fresh module graph. */
const load = async (): Promise<void> => {
  await import('../register.js');
};

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('lit-ui-router-ssr/register', () => {
  it('defines both tags, with a served <ui-view>', async () => {
    const defined = stubRegistry();

    await load();

    const { UiView } = await import('lit-ui-router/pure');
    const { isServedViewClass } = await import('../served-view.js');
    expect(defined.get('ui-router')).toBeTypeOf('function');
    const view = defined.get('ui-view');
    expect(isServedViewClass(view)).toBe(true);
    expect(view!.prototype).toBeInstanceOf(UiView);
  });

  it('leaves a served <ui-view> another copy defined alone', async () => {
    const defined = stubRegistry();
    await load();
    const first = defined.get('ui-view');

    vi.resetModules();
    await expect(load()).resolves.toBeUndefined();

    expect(defined.get('ui-view')).toBe(first);
  });

  it("keeps core's root entry silent when it runs after the served register", async () => {
    const defined = stubRegistry();
    await load();
    const served = defined.get('ui-view');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await import('lit-ui-router');

    expect(defined.get('ui-view')).toBe(served);
    expect(warn).not.toHaveBeenCalled();
  });

  it('defines a class that answers the slot the enclosing render reaches with noChange', () => {
    const Served = withServedRender(UiView);

    expect((Served.prototype as ServedUiView).renderLight()).toBe(noChange);
  });

  it('throws on a foreign <ui-view>, naming both ways out', async () => {
    const defined = stubRegistry();
    defined.set('ui-view', class extends HTMLElement {});

    await expect(load()).rejects.toThrow(
      /lit-ui-router-ssr: <ui-view> is already defined by another class/,
    );
    await expect(load()).rejects.toThrow(/lit-ui-router-ssr\/register/);
    await expect(load()).rejects.toThrow(/lit-ui-router\/pure/);
  });
});
