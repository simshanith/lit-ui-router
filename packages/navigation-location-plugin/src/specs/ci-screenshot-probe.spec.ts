/// <reference types="vitest/globals" />

// TEMPORARY: fails on purpose so CI writes a failure screenshot. Reverted
// before merge.
describe('CI failure screenshot probe', () => {
  it('fails with something on the page to capture', () => {
    const banner = document.createElement('h1');
    banner.textContent = 'vitest failure screenshot probe (#611)';
    banner.style.cssText =
      'padding:48px;background:#fde68a;font:32px sans-serif';
    document.body.append(banner);
    expect(banner.textContent).toBe('a screenshot should show this failing');
  });
});
