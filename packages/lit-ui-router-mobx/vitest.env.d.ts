// test:lit2-compat / test:mobx6-compat expected majors; the VITE_ prefix
// carries them in. Repo-internal: seen only through tsconfig.json alongside
// vitest.setup.ts.
interface ImportMetaEnv {
  readonly VITE_EXPECT_LIT_MAJOR?: string;
  readonly VITE_EXPECT_MOBX_MAJOR?: string;
}
