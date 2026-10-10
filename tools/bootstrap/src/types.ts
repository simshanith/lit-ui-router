// Generic package-manifest vocabulary shared across the tools packages.
// Dependency-free on purpose; types only. Matches @pnpm/types except on
// `exports` -- see ./types.test-d.ts, which pins that one divergence and
// records why adopting theirs outright would be a regression.

// npm spec: a specifier is a string. Trusted on the same terms as `name` and
// `version` below -- one cast at the JSON.parse in ./manifest.ts, not a guard
// per read.
export type DependencyMap = Record<string, string>;

// A parsed JSON value.
export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

// A subpath or condition maps to a target, nested conditions, a fallback list, or null.
export type ExportsTarget = string | null | ExportsConditions | ExportsTarget[];

export interface ExportsConditions {
  [subpathOrCondition: string]: ExportsTarget;
}

// The slice of a package.json the tools read.
export type PackageManifest = {
  name?: string;
  version?: string;
  private?: boolean;
  // `<name>@<version>+<integrity>`; the root manifest's is the pnpm authority
  packageManager?: string;
  scripts?: Record<string, string>;
  exports?: ExportsConditions;
  dependencies?: DependencyMap;
  devDependencies?: DependencyMap;
  peerDependencies?: DependencyMap;
  optionalDependencies?: DependencyMap;
};
