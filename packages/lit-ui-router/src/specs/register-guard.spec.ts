// No static register import: the stubs must be defined before the modules evaluate.

// One helper for both stubs; the tag is a parameter so each `it` reads the
// same. (This also keeps the stub out of lit-analyzer's tag registry, which
// only matches `customElements.define('<literal>', X)` — incidental now that
// the analyzer sees ui-view.ts/ui-router.ts, whose real definitions win.)
function defineStub(tag: string): CustomElementConstructor {
  class Stub extends HTMLElement {}
  customElements.define(tag, Stub);
  return Stub;
}

// The real registry already holds each tag once the cases above run, so the
// subclass cases define into a registry of their own from a fresh module graph.
function stubRegistry(): Map<string, CustomElementConstructor> {
  const defined = new Map<string, CustomElementConstructor>();
  vi.stubGlobal('customElements', {
    get: (name: string) => defined.get(name),
    define: (name: string, constructor: CustomElementConstructor) => {
      if (defined.has(name)) throw new Error(`already defined: ${name}`);
      defined.set(name, constructor);
    },
  });
  vi.resetModules();
  return defined;
}

describe('duplicate registration guard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('warns and keeps the first ui-view definition', async () => {
    const Stub = defineStub('ui-view');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await import('../ui-view.register.js');

    expect(customElements.get('ui-view')).toBe(Stub);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('<ui-view> is already defined'),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('<ui-view> is already defined by Stub;'),
    );
    warn.mockRestore();
  });

  it('warns and keeps the first ui-router definition', async () => {
    const Stub = defineStub('ui-router');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await import('../ui-router.register.js');

    expect(customElements.get('ui-router')).toBe(Stub);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('<ui-router> is already defined'),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('<ui-router> is already defined by Stub;'),
    );
    warn.mockRestore();
  });

  it('stays silent for a subclass of UiView and keeps it', async () => {
    const defined = stubRegistry();
    const { UiView } = await import('../ui-view.js');
    class ServedView extends UiView {}
    defined.set('ui-view', ServedView);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await import('../ui-view.register.js');

    expect(defined.get('ui-view')).toBe(ServedView);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('stays silent for a subclass of UIRouterLitElement and keeps it', async () => {
    const defined = stubRegistry();
    const { UIRouterLitElement } = await import('../ui-router.js');
    class RouterHost extends UIRouterLitElement {}
    defined.set('ui-router', RouterHost);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await import('../ui-router.register.js');

    expect(defined.get('ui-router')).toBe(RouterHost);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
