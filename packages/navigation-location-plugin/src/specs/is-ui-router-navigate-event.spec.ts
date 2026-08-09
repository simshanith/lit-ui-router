/// <reference types="vitest/globals" />
/// <reference types="@types/dom-navigation" />

import { UIRouter } from '@uirouter/core';
import { isUIRouterNavigateEvent } from '../index.js';

// Pure predicate over plain objects: no window.navigation, so this runs in
// happy-dom while the rest of the suite pays for a real browser.
describe('isUIRouterNavigateEvent', () => {
  it('returns true for events with valid UIRouter instance in info', () => {
    const router = new UIRouter();
    const event = {
      info: { uiRouter: router },
    } as unknown as NavigateEvent;

    expect(isUIRouterNavigateEvent(event)).toBe(true);
  });

  it('returns false for events without info', () => {
    const event = {} as NavigateEvent;
    expect(isUIRouterNavigateEvent(event)).toBe(false);
  });

  it('returns false for events with non-UIRouter info', () => {
    const event = {
      info: { uiRouter: {} },
    } as unknown as NavigateEvent;

    expect(isUIRouterNavigateEvent(event)).toBe(false);
  });

  it('returns false for events with null info', () => {
    const event = {
      info: null,
    } as unknown as NavigateEvent;

    expect(isUIRouterNavigateEvent(event)).toBe(false);
  });

  it('returns false for undefined input', () => {
    expect(isUIRouterNavigateEvent(undefined)).toBe(false);
  });
});
