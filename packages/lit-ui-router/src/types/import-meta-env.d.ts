// Ambient shape for the `import.meta.env` keys this package reads — the whole
// surface, deliberately narrow. Not `vite/client`: that pulls in asset-module
// declarations nothing here wants, and TS 6 defaults `types` to `[]`, so it
// would have to be named in three tsconfigs to be seen.
//
// Not published: `files` ships `src/*.ts`, one level only, so `src/types/`
// stays out of the tarball and this augmentation never reaches consumers.
// `@tools/oxc-emit` `define`s `import.meta.env.DEV` in both emit passes, so no
// `import.meta` survives into `dist/` either.
interface ImportMetaEnv {
  /**
   * Vite/vitest supply this unconfigured; `@tools/oxc-emit` replaces it with a
   * literal per emit pass (`true` for dist/development, `false` for dist).
   * Guards the dev-only warnings — see check:dev-split.
   */
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
