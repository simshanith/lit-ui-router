// Suppress the per-worker "Lit is in dev mode" banner: https://github.com/lit/lit/issues/4877
const g = globalThis as typeof globalThis & {
  litIssuedWarnings?: Set<unknown>;
};
(g.litIssuedWarnings ??= new Set())
  .add('dev-mode')
  .add(
    'Lit is in dev mode. Not recommended for production! See https://lit.dev/msg/dev-mode for more information.',
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

// Guards the mobx6-compat alias swap in both directions. mobx publishes no
// version global, but the majors are cleanly discriminated by the namespaced
// -> named export split: 7 has `compareStructural`, 6 has `comparer`.
const expectedMobxMajor =
  (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_EXPECT_MOBX_MAJOR ?? '7';
const mobx = await import('mobx');
const actualMobxMajor = 'compareStructural' in mobx ? '7' : '6';
if (actualMobxMajor !== expectedMobxMajor) {
  throw new Error(
    `vitest.setup: expected mobx major ${expectedMobxMajor}, saw ${actualMobxMajor}`,
  );
}

// top-level await above requires module-hood even with no exports
export {};
