// The shim must be on globalThis before lit (or this package) evaluates.
import '@lit-labs/ssr/lib/install-global-dom-shim.js';
import {
  assertLitMajor,
  silenceLitDevModeBanner,
} from '@tools/lit-test-env/setup.ts';

silenceLitDevModeBanner();

// @lit-labs/ssr 4 needs lit 3, so this lane never joins test:lit2-compat.
await import('lit');
assertLitMajor('3');

export {};
