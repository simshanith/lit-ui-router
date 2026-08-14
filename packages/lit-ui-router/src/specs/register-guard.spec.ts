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
