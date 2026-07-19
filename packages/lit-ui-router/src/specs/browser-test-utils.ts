import { page, UserEventClickOptions } from 'vitest/browser';

// Browser-project-only: vitest/browser has no node implementation.
export function clickLocatedElement(
  element: Element,
  options: UserEventClickOptions = {},
) {
  return page.elementLocator(element).click(options);
}
