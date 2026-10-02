// Not `vite/client` (TS 6 `types` defaults to `[]`); never published, since `define` folds every `import.meta.env` read out of dist/.
interface ImportMetaEnv {
  /** `true` in dist/development, `false` in dist — see check:dev-split. */
  readonly DEV: boolean;
  /** This package's manifest version, defined by oxc-emit-js and by vitest's `test.env`. */
  readonly PACKAGE_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
