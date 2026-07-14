// Vocabulary the check:* entries share but none of them owns. Dependency-free
// on purpose; types only, save for consts the types derive from.

export const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

/** One of the four npm dependency fields. */
export type DepField = (typeof DEP_FIELDS)[number];

// What every core hands its IO shell: `text` to print, `ok` to exit on.
export type Report = { ok: boolean; text: string };
