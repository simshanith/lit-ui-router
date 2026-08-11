// No static register import: the stubs must be defined before the modules evaluate.

// Defining through a helper keeps the stub out of lit-analyzer's program-wide
// tag registry: it only matches `customElements.define('<literal>', X)`.
function defineStub(tag: string): CustomElementConstructor {
  class Stub extends HTMLElement {}
  customElements.define(tag, Stub);
  return Stub;
}

describe('duplicate registration guard', () => {
  it('warns and keeps the first ui-view definition', async () => {
    const Stub = defineStub('ui-view');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await import('../ui-view.register.js');

    expect(customElements.get('ui-view')).toBe(Stub);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('<ui-view> is already defined'),
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
    warn.mockRestore();
  });
});
