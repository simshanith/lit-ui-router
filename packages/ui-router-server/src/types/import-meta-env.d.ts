// Not `vite/client` (TS 6 `types` defaults to `[]`); never published, since `define` folds every `import.meta.env` read out of dist/.
interface ImportMetaEnv {
  /** `true` in dist/development and dist/node, `false` in dist — see check:dev-split. */
  readonly DEV: boolean;
  /** `true` in dist/node only, whose warnings read `process.env.NODE_ENV` at runtime. */
  readonly NODE: boolean;
}

interface ImportMeta {
  /** Optional: node --test runs src unbundled, where nothing defines it. */
  readonly env?: ImportMetaEnv;
}
