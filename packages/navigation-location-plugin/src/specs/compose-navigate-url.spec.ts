/// <reference types="vitest/globals" />

import { composeNavigateUrl } from '../compose-navigate-url.js';

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

  it.each([
    ['/', '/evil.example'],
    ['/app', '/evil.example'],
    ['/app/', '/app//evil.example'],
  ])(
    'keeps a URL that begins with // on this origin under %s',
    (baseHref, expected) => {
      expect(composeNavigateUrl('//evil.example', baseHref)).toBe(expected);
    },
  );

  it('collapses a longer leading run of slashes to one', () => {
    expect(composeNavigateUrl('///evil.example', '/')).toBe('/evil.example');
    expect(composeNavigateUrl('//', '/')).toBe('/');
  });

  it('collapses a leading run that mixes in backslashes, which the URL parser reads as slashes', () => {
    expect(composeNavigateUrl('/\\evil.example', '/')).toBe('/evil.example');
    expect(composeNavigateUrl('\\evil.example', '/')).toBe('/evil.example');
    expect(composeNavigateUrl('\\/evil.example', '/app')).toBe('/evil.example');
    expect(composeNavigateUrl('/\\evil.example', '/app/')).toBe(
      '/app/\\evil.example',
    );
  });

  it('leaves the url as written below a base prefix, where it names this origin', () => {
    expect(composeNavigateUrl('///evil.example', '/app/')).toBe(
      '/app///evil.example',
    );
    expect(composeNavigateUrl('//', '/app/')).toBe('/app//');
  });

  it('keeps the query and hash of a URL that begins with //', () => {
    expect(composeNavigateUrl('//evil.example/a?q=1#top', '/')).toBe(
      '/evil.example/a?q=1#top',
    );
    expect(composeNavigateUrl('//evil.example/a?q=1#top', '/app/')).toBe(
      '/app//evil.example/a?q=1#top',
    );
  });

  it('leaves slashes below the first segment as written', () => {
    expect(composeNavigateUrl('/a//b?next=//c#//d', '/app/')).toBe(
      '/app/a//b?next=//c#//d',
    );
  });
});
