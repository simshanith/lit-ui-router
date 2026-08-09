/// <reference types="vitest/globals" />

import { composeNavigateUrl } from '../index.js';

// Pure string math over (url, baseHref): no DOM, no Navigation API, so this
// runs in the plain node project rather than paying for happy-dom or a browser.
describe('composeNavigateUrl', () => {
  it('returns the baseHref for an empty URL', () => {
    expect(composeNavigateUrl('', '/app/')).toBe('/app/');
  });

  it('returns the baseHref for the root URL', () => {
    expect(composeNavigateUrl('/', '/app/')).toBe('/app/');
  });

  it('prepends the base prefix to non-root URLs', () => {
    expect(composeNavigateUrl('/users', '/app/')).toBe('/app/users');
  });

  it('adds a leading slash if the URL does not start with one', () => {
    expect(composeNavigateUrl('users', '/app/')).toBe('/app/users');
  });

  it('leaves URLs untouched under a root baseHref', () => {
    expect(composeNavigateUrl('/users', '/')).toBe('/users');
    expect(composeNavigateUrl('users', '/')).toBe('/users');
    expect(composeNavigateUrl('', '/')).toBe('/');
    expect(composeNavigateUrl('/', '/')).toBe('/');
  });

  it('strips a trailing filename from the baseHref', () => {
    expect(composeNavigateUrl('/users', '/base/index.html')).toBe(
      '/base/users',
    );
  });

  it('handles a nested baseHref', () => {
    expect(composeNavigateUrl('/users', '/foo/base/')).toBe('/foo/base/users');
  });

  it('treats a baseHref without a trailing slash as having no prefix', () => {
    expect(composeNavigateUrl('/users', '/base')).toBe('/users');
  });

  it('preserves query and hash on the composed URL', () => {
    expect(composeNavigateUrl('/users?q=1#top', '/app/')).toBe(
      '/app/users?q=1#top',
    );
  });
});
