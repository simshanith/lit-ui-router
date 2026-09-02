// Not `vite/client` (TS 6 `types` defaults to `[]`; asset modules unwanted).
// Never published: `files` ships `src/*.ts` one level deep, and `define` folds
// every `import.meta.env.DEV` read out of dist/, so consumers never see this.
interface ImportMetaEnv {
  /** `true` in dist/development, `false` in dist — see check:dev-split. */
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
