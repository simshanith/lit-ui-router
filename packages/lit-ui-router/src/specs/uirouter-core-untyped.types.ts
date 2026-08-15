import { equals, forEach, root } from '@uirouter/core';

// Type-level canary — the compile is the assertion (package `typecheck`;
// umbrella tsconfig covers src/specs); never executed.
//
// `@uirouter/core` assigns these at load time from an optional AngularJS
// global (`common.js`: `exports.forEach = angular.forEach || _forEach`), so
// its .d.ts declares them `any`. Each of our uses therefore binds a narrowed
// signature at module scope, with the reason alongside it:
//
//   equals  -> packages/lit-ui-router/src/ui-sref.ts       (paramsEqual)
//   forEach -> packages/lit-ui-router/src/core.ts          (forEachValue)
//   root    -> packages/navigation-location-plugin/src/index.ts (globalRoot)
//
// Note `x satisfies SomeSignature` would be worthless here: `any` is
// assignable to everything, so it can never fail. The assertion that has
// teeth is the opposite one — that the symbol is *still* `any`. When core
// starts typing one of these, its line below stops compiling, which is the
// signal to delete the corresponding cast rather than carry it forever.

/** `true` only for `any` — `1 & T` collapses to `any`, and `0 extends any`. */
type IsAny<T> = 0 extends 1 & T ? true : false;

export const coreStillShipsAny = {
  equals: true satisfies IsAny<typeof equals>,
  forEach: true satisfies IsAny<typeof forEach>,
  root: true satisfies IsAny<typeof root>,
};
