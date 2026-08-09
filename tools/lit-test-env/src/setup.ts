/**
 * Suppresses the per-worker "Lit is in dev mode" banner:
 * https://github.com/lit/lit/issues/4877
 *
 * Both strings are required: lit checks the short key, older lines the
 * full message.
 */
export function silenceLitDevModeBanner(): void {
  const g = globalThis as typeof globalThis & {
    litIssuedWarnings?: Set<unknown>;
  };
  (g.litIssuedWarnings ??= new Set())
    .add('dev-mode')
    .add(
      'Lit is in dev mode. Not recommended for production! See https://lit.dev/msg/dev-mode for more information.',
    );
}

/**
 * Fails a run that resolved the wrong lit line, before any spec does: the
 * dev build pushes its lit-html version (majors track lit's own) onto the
 * global this reads.
 *
 * Deliberately takes no part in resolving lit, nor in reading the expected
 * major. The caller must do both in its own vitest.setup.ts:
 * - `await import('lit')`, because the lit2-compat alias rewrites `lit` to
 *   the `lit-2` npm-alias devDep, which pnpm links only into the consuming
 *   package — an import issued from here resolves against this package.
 * - `import.meta.env.VITE_EXPECT_LIT_MAJOR`, because vite only injects env
 *   where it is read in-module; passing `import.meta` across a module
 *   boundary silently loses it in the browser projects.
 */
export function assertLitMajor(expectedMajor: string): void {
  const litHtmlVersions =
    (globalThis as typeof globalThis & { litHtmlVersions?: string[] })
      .litHtmlVersions ?? [];
  if (
    litHtmlVersions.length === 0 ||
    litHtmlVersions.some((v) => !v.startsWith(`${expectedMajor}.`))
  ) {
    throw new Error(
      `vitest.setup: expected lit-html major ${expectedMajor}, ` +
        `saw [${litHtmlVersions.join(', ')}]`,
    );
  }
}
