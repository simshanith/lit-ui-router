// Type-level pin on how ./types.ts relates to @pnpm/types. There is no runtime
// here and nothing to execute — `tsc --noEmit` IS the assertion, so this file
// rides the package's existing `typecheck` task. The `.test-d.ts` suffix keeps
// it out of `node --test "src/**/*.test.ts"`.
//
// Why pin it at all: tools/release hands pnpm-SDK manifests to helpers typed
// with ours (release-pack.core.ts takes a ProjectManifest and imports
// @tools/shared), so the widening below is load-bearing. Both directions are
// asserted; a @ts-expect-error that stops erroring fails this file, so pnpm
// narrowing OR widening its types shows up here rather than at a call site.
import type {
  BaseManifest,
  Dependencies,
  PackageManifest as PnpmPackageManifest,
  ProjectManifest,
} from '@pnpm/types';

import type { DependencyMap, PackageManifest } from './types.ts';

/** Assignability probe: the call typechecks iff the argument satisfies T. */
declare function accepts<T>(value: T): T;

declare const pnpmBase: BaseManifest;
declare const pnpmProject: ProjectManifest;
declare const pnpmPackage: PnpmPackageManifest;
declare const pnpmDependencies: Dependencies;
declare const ourDependencies: DependencyMap;

// -- ours is a supertype: every pnpm manifest flavour satisfies it ------------

accepts<PackageManifest>(pnpmBase);
accepts<PackageManifest>(pnpmProject);
accepts<PackageManifest>(pnpmPackage);

// -- but not the reverse, on exactly two properties ---------------------------

// Specifiers: pnpm's `Dependencies` is Record<string, string>; ours stays
// `unknown` until a guard proves them strings, which is strictly wider.
accepts<DependencyMap>(pnpmDependencies);
// @ts-expect-error -- narrowing DependencyMap to string would be the drift
accepts<Dependencies>(ourDependencies);

// Exports: pnpm models `exports` as Record<string, string>, which cannot hold a
// conditions object. This repo's own packages ship one, so adopting pnpm's type
// wholesale would reject the manifests bundle-probe exists to read.
const conditionalExports = {
  exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } },
};

accepts<PackageManifest>(conditionalExports);
// @ts-expect-error -- pnpm's exports is too narrow for conditional subpaths
accepts<BaseManifest>(conditionalExports);
