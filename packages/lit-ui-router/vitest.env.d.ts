// test:lit2-compat's expected lit major; the VITE_ prefix carries it in.
// Repo-internal: seen only through tsconfig.json alongside vitest.setup.ts.
interface ImportMetaEnv {
  readonly VITE_EXPECT_LIT_MAJOR?: string;
}
