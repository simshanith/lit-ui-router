// Generic package-manifest vocabulary shared across the tools packages.
// Dependency-free on purpose; types only.

// Specifiers arrive from parsed package.json, so they stay `unknown` until a
// guard proves them strings.
export type DependencyMap = Record<string, unknown>;

// The slice of a package.json the tools read.
export type PackageManifest = {
  name?: string;
  version?: string;
  private?: boolean;
  scripts?: Record<string, unknown>;
  // subpath -> string target or a conditions object; shape is caller-checked
  exports?: Record<string, unknown>;
  dependencies?: DependencyMap;
  devDependencies?: DependencyMap;
  peerDependencies?: DependencyMap;
  optionalDependencies?: DependencyMap;
};
