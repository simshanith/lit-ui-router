// The coexistence lane: lit's own hydrate support installs through `globalThis.litElementHydrateSupport`, which `lit-element` reads once at module evaluation, so it has to be imported before anything reaches `lit` — the client setup's own version check included.
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
import {
  assertLitMajor,
  silenceLitDevModeBanner,
} from '@tools/lit-test-env/setup.ts';

silenceLitDevModeBanner();

// @lit-labs/ssr 4 needs lit 3, so this package has no lit 2 compat lane.
await import('lit');
assertLitMajor('3');

export {};
