// Suppress the per-worker "Lit is in dev mode" banner: https://github.com/lit/lit/issues/4877
const g = globalThis as typeof globalThis & { litIssuedWarnings?: Set<unknown> };
(g.litIssuedWarnings ??= new Set()).add('dev-mode');
