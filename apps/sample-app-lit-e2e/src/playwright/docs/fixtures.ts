import { test as base, expect } from '@playwright/test';

export { expect };

export const test = base.extend({
  // A pending third-party badge holds back `load`; no docs spec asserts on badges.
  context: async ({ context }, use) => {
    await context.route('https://img.shields.io/**', (route) =>
      route.abort('blockedbyclient'),
    );
    await use(context);
  },
});
