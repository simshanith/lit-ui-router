import {
  assertLitMajor,
  silenceLitDevModeBanner,
} from '@tools/lit-test-env/setup.ts';

silenceLitDevModeBanner();

// Both stay in-module: the import so the lit2-compat alias resolves against
// this package's lit-2 devDep, the env read because vite only injects
// import.meta.env where it is read in-module (browser projects included).
// Typed by src/types/import-meta-env.d.ts, not vite/client.
const expectedLitMajor = import.meta.env.VITE_EXPECT_LIT_MAJOR ?? '3';
await import('lit');
assertLitMajor(expectedLitMajor);

// top-level await above requires module-hood even with no exports
export {};
