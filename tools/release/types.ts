// Vocabulary the check:* scripts share but none of them owns. Dependency-free
// on purpose; types only, save for consts the types derive from.

export const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

/** One of the four npm dependency fields. */
export type DepField = (typeof DEP_FIELDS)[number];

// Specifiers arrive from parsed package.json, so they stay `unknown` until a
// guard proves them strings.
export type DependencyMap = Record<string, unknown>;

// The slice of a package.json these checks read.
export type PackageManifest = {
  name?: string;
  private?: boolean;
  dependencies?: DependencyMap;
  devDependencies?: DependencyMap;
  peerDependencies?: DependencyMap;
  optionalDependencies?: DependencyMap;
};

// What every core hands its IO shell: `text` to print, `ok` to exit on.
export type Report = { ok: boolean; text: string };
