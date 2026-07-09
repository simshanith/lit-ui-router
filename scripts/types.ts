// Vocabulary shared by the check:* scripts: the package.json fields they read,
// and the workspace members they read them from. Dependency-free on purpose —
// it lets check-catalog.core.ts and check-pack.core.ts share a definition
// without importing each other, and lets workspace.ts name its own return type.
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

// `dir` is relative to the workspace root, and is '<root>' for the root itself.
export type Member = {
  name: string;
  dir: string;
  manifest?: Manifest;
};

// What every core hands its IO shell: `text` to print, `ok` to exit on.
export type Report = { ok: boolean; text: string };
