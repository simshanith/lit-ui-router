import {
  assertLitMajor,
  silenceLitDevModeBanner,
} from '@tools/lit-test-env/setup.ts';

silenceLitDevModeBanner();

// Both stay in-module: the import so the lit2-compat alias resolves against
// this package's lit-2 devDep, the env read because vite only injects
// import.meta.env where it is read in-module (browser projects included).
// Typed by vitest.env.d.ts, not vite/client.
const expectedLitMajor = import.meta.env.VITE_EXPECT_LIT_MAJOR ?? '3';
await import('lit');
assertLitMajor(expectedLitMajor);

// Guards the effect3-compat alias swap in both directions: effect 4 moved
// the change stream to the module-level `SubscriptionRef.changes`.
const expectedEffectMajor = import.meta.env.VITE_EXPECT_EFFECT_MAJOR ?? '4';
const { SubscriptionRef } = await import('effect');
const actualEffectMajor = 'changes' in SubscriptionRef ? '4' : '3';
if (actualEffectMajor !== expectedEffectMajor) {
  throw new Error(
    `vitest.setup: expected effect major ${expectedEffectMajor}, saw ${actualEffectMajor}`,
  );
}

// top-level await above requires module-hood even with no exports
export {};
