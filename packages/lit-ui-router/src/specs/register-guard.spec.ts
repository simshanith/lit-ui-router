// No static register import: the stubs must be defined before the modules evaluate.
describe('duplicate registration guard', () => {
  it('warns and keeps the first ui-view definition', async () => {
    class Stub extends HTMLElement {}
    customElements.define('ui-view', Stub);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await import('../ui-view.register.js');

    expect(customElements.get('ui-view')).toBe(Stub);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('<ui-view> is already defined'),
    );
    warn.mockRestore();
  });

  it('warns and keeps the first ui-router definition', async () => {
    class Stub extends HTMLElement {}
    customElements.define('ui-router', Stub);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await import('../ui-router.register.js');

    expect(customElements.get('ui-router')).toBe(Stub);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('<ui-router> is already defined'),
    );
    warn.mockRestore();
  });
});
