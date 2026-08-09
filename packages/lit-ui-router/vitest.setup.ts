// Suppress the per-worker "Lit is in dev mode" banner: https://github.com/lit/lit/issues/4877
const g = globalThis as typeof globalThis & {
  litIssuedWarnings?: Set<unknown>;
};
// lit 3 dedupes on the code OR the message; lit 2 only ever checks the
// message, so the lit2-compat lane stays noisy unless both are seeded.
(g.litIssuedWarnings ??= new Set())
  .add('dev-mode')
  .add(
    'Lit is in dev mode. Not recommended for production! ' +
      'See https://lit.dev/msg/dev-mode for more information.',
  );

// Guards the lit2-compat alias swap in both directions: the dev build pushes
// its lit-html version (majors track lit's own) onto the global, so a run
// that resolved the wrong lit line fails before any spec does. The expected
// major arrives via import.meta.env, which reaches the browser projects too
// (process.env does not); the cast spares every tsconfig vite/client types.
const expectedLitMajor =
  (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_EXPECT_LIT_MAJOR ?? '3';
await import('lit');
const litHtmlVersions =
  (globalThis as typeof globalThis & { litHtmlVersions?: string[] })
    .litHtmlVersions ?? [];
if (
  litHtmlVersions.length === 0 ||
  litHtmlVersions.some((v) => !v.startsWith(`${expectedLitMajor}.`))
) {
  throw new Error(
    `vitest.setup: expected lit-html major ${expectedLitMajor}, ` +
      `saw [${litHtmlVersions.join(', ')}]`,
  );
}

// top-level await above requires module-hood even with no exports
export {};
