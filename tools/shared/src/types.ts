// Generic package-manifest vocabulary shared across the tools packages.
// Dependency-free on purpose; types only. Matches @pnpm/types except on
// `exports` -- see ./types.test-d.ts, which pins that one divergence and
// records why adopting theirs outright would be a regression.

// npm spec: a specifier is a string. Trusted on the same terms as `name` and
// `version` below -- one cast at the JSON.parse in ./manifest.ts, not a guard
// per read.
export type DependencyMap = Record<string, string>;

// The slice of a package.json the tools read.
export type PackageManifest = {
  name?: string;
  version?: string;
  private?: boolean;
  scripts?: Record<string, string>;
  // the one field that is genuinely not a string map: a subpath maps to a
  // string target or a conditions object, so the shape is caller-checked
  exports?: Record<string, unknown>;
  dependencies?: DependencyMap;
  devDependencies?: DependencyMap;
  peerDependencies?: DependencyMap;
  optionalDependencies?: DependencyMap;
};
