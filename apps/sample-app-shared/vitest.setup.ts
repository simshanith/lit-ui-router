// Suppress the per-browser "Lit is in dev mode" banner: https://github.com/lit/lit/issues/4877
const g = globalThis as typeof globalThis & {
  litIssuedWarnings?: Set<unknown>;
};
(g.litIssuedWarnings ??= new Set())
  .add('dev-mode')
  .add(
    'Lit is in dev mode. Not recommended for production! See https://lit.dev/msg/dev-mode for more information.',
  );

export {};
