// Not `vite/client` (TS 6 `types` defaults to `[]`); never published, since `define` folds every `import.meta.env` read out of dist/.
interface ImportMetaEnv {
  /** `true` in dist/development, `false` in dist — see check:dev-split. */
  readonly DEV: boolean;
}

interface ImportMeta {
  /** Optional: node --test runs src unbundled, where nothing defines it. */
  readonly env?: ImportMetaEnv;
}
