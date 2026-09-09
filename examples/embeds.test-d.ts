// Type-level pin on the per-example npm scripts. There is no runtime here and
// nothing to execute — `tsc --noEmit` IS the assertion, so this file rides
// //#typecheck:root. The `.test-d.ts` suffix keeps it out of the package's
// `node --test "*.test.ts"`, which matters more than convention: the probe
// calls below are real expressions, and `declare` erases, so running this file
// would throw ReferenceError.
//
// Why pin it at all: `postinstall` fans out over `npm:example:install:*`, so an
// example whose install script is missing is silently skipped by `mise run
// setup` and left without node_modules.
import pkg from './package.json' with { type: 'json' };

import type { ExampleName } from './embeds.ts';

/** Assignability probe: the call typechecks iff the argument satisfies T. */
declare function accepts<T>(value: T): T;

type Script = keyof typeof pkg.scripts;

declare const declaredInstall: Extract<Script, `example:install:${string}`>;
declare const declaredTypecheck: Extract<Script, `typecheck:${string}`>;
declare const requiredInstall: `example:install:${ExampleName}`;
declare const requiredTypecheck: `typecheck:${ExampleName}`;

// -- every example has both scripts -------------------------------------------

accepts<typeof declaredInstall>(requiredInstall);
accepts<typeof declaredTypecheck>(requiredTypecheck);

// -- and neither script outlives its example ----------------------------------

accepts<`example:install:${ExampleName}`>(declaredInstall);
accepts<`typecheck:${ExampleName}`>(declaredTypecheck);
