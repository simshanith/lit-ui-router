// Not `vite/client` (TS 6 `types` defaults to `[]`); never published, since `define` folds every `import.meta.env` read out of dist/.
interface ImportMetaEnv {
  /** This package's manifest version, defined by oxc-emit-js, by vitest's `test.env` and by the demo's vite config. */
  readonly PACKAGE_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
