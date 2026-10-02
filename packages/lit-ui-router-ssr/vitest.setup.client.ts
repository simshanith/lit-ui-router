// The client lane: a happy-dom document, no @lit-labs/ssr DOM shim — the shim's globals would win over the ones hydration walks.
import {
  assertLitMajor,
  silenceLitDevModeBanner,
} from '@tools/lit-test-env/setup.ts';

silenceLitDevModeBanner();

// @lit-labs/ssr 4 needs lit 3, so this package has no lit 2 compat lane.
await import('lit');
assertLitMajor('3');

export {};
