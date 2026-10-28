// Guards the effect3-compat alias swap in both directions: effect 4 moved
// the change stream to the module-level `SubscriptionRef.changes`.
const expectedEffectMajor = process.env.VITE_EXPECT_EFFECT_MAJOR ?? '4';

const { SubscriptionRef } = await import('effect');

const actualEffectMajor = 'changes' in SubscriptionRef ? '4' : '3';

if (actualEffectMajor !== expectedEffectMajor) {
  throw new Error(
    `vitest.setup: expected effect major ${expectedEffectMajor}, saw ${actualEffectMajor}`,
  );
}

// top-level await above requires module-hood even with no exports
export {};
