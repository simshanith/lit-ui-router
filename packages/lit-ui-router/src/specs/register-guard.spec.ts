// No static register import: the stub must be defined before the module evaluates.
describe('duplicate registration guard', () => {
  it('warns and keeps the first definition', async () => {
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
});
