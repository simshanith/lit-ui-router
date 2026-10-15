// Guards the mobx6-compat alias swap in both directions. mobx publishes no
// version global, but the majors are cleanly discriminated by the namespaced
// -> named export split: 7 has `compareStructural`, 6 has `comparer`.
const expectedMobxMajor = process.env.VITE_EXPECT_MOBX_MAJOR ?? '7';

const mobx = await import('mobx');

const actualMobxMajor = 'compareStructural' in mobx ? '7' : '6';

if (actualMobxMajor !== expectedMobxMajor) {
  throw new Error(
    `vitest.setup: expected mobx major ${expectedMobxMajor}, saw ${actualMobxMajor}`,
  );
}

// top-level await above requires module-hood even with no exports
export {};
