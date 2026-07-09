// Vocabulary the check:* scripts share but none of them owns: the package.json
// fields they read, and the report their cores hand back. Dependency-free on
// purpose, so check-catalog.core.ts and check-pack.core.ts can share a
// definition without importing each other.
//
// Types only, but for DEP_FIELDS: DepField derives from it, and a hand-written
// union would drift from the array the checks actually iterate.

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
export type Manifest = {
  name?: string;
  private?: boolean;
  dependencies?: DependencyMap;
  devDependencies?: DependencyMap;
  peerDependencies?: DependencyMap;
  optionalDependencies?: DependencyMap;
};

// What every core hands its IO shell: `text` to print, `ok` to exit on.
export type Report = { ok: boolean; text: string };
