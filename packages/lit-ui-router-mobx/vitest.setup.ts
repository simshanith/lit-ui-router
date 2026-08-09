import {
  assertLitMajor,
  silenceLitDevModeBanner,
} from '@tools/lit-test-env/setup.ts';

silenceLitDevModeBanner();

// Both stay in-module: the import so the lit2-compat alias resolves against
// this package's lit-2 devDep, the env read because vite only injects
// import.meta.env where it is read in-module (browser projects included).
const expectedLitMajor =
  (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_EXPECT_LIT_MAJOR ?? '3';
await import('lit');
assertLitMajor(expectedLitMajor);

// Guards the mobx6-compat alias swap in both directions. mobx publishes no
// version global, but the majors are cleanly discriminated by the namespaced
// -> named export split: 7 has `compareStructural`, 6 has `comparer`.
const expectedMobxMajor =
  (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_EXPECT_MOBX_MAJOR ?? '7';
const mobx = await import('mobx');
const actualMobxMajor = 'compareStructural' in mobx ? '7' : '6';
if (actualMobxMajor !== expectedMobxMajor) {
  throw new Error(
    `vitest.setup: expected mobx major ${expectedMobxMajor}, saw ${actualMobxMajor}`,
  );
}

// top-level await above requires module-hood even with no exports
export {};
