import { describe, expect, it } from 'vitest';

import { DOM_SHIM, litPreload } from '../vite-preload.js';

describe('litPreload', () => {
  it('loads the shim, then register, then the app’s preloads', () => {
    expect(litPreload(DOM_SHIM, ['./src/setup.ts'])).toEqual([
      '@lit-labs/ssr/lib/install-global-dom-shim.js',
      'lit-ui-router-ssr/register',
      './src/setup.ts',
    ]);
  });

  it('swaps in the app’s own DOM, or none', () => {
    expect(litPreload(['happy-dom-shim', './dom.ts'], [])).toEqual([
      'happy-dom-shim',
      './dom.ts',
      'lit-ui-router-ssr/register',
    ]);
    expect(litPreload([], [])).toEqual(['lit-ui-router-ssr/register']);
  });

  it('keeps one copy of a module listed twice, at its first position', () => {
    expect(
      litPreload(DOM_SHIM, [
        'lit-ui-router-ssr/register',
        '@lit-labs/ssr/lib/install-global-dom-shim.js',
        './src/setup.ts',
      ]),
    ).toEqual([
      '@lit-labs/ssr/lib/install-global-dom-shim.js',
      'lit-ui-router-ssr/register',
      './src/setup.ts',
    ]);
  });
});
