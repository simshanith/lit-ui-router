// Suppress the per-browser "Lit is in dev mode" banner: https://github.com/lit/lit/issues/4877
const g = globalThis as typeof globalThis & {
  litIssuedWarnings?: Set<unknown>;
};
// lit 3 dedupes on the code OR the message; seeding both keeps this quiet on
// either line, and one banner per browser instance is three times the noise.
(g.litIssuedWarnings ??= new Set())
  .add('dev-mode')
  .add(
    'Lit is in dev mode. Not recommended for production! ' +
      'See https://lit.dev/msg/dev-mode for more information.',
  );

export {};
