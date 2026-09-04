// Pure logic for check-release-closure.ts, which owns the IO.

/** Members a release lane needs installed, and which lane needs them. */
export type ClosureRule = {
  need: string;
  /** Why these members. */
  why: string;
};

/** The filter string as pnpm argv: whitespace-split, empty tokens dropped. */
export function filterArgs(filter: string): string[] {
  return filter.split(/\s+/u).filter((token) => token !== '');
}

/** Project names from `pnpm ls -r --depth -1 --json`. */
export function selectedNames(json: string): string[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error('pnpm ls --json did not return an array');
  }
  return parsed.map((project: unknown) => {
    const name =
      typeof project === 'object' && project !== null && 'name' in project
        ? project.name
        : undefined;
    if (typeof name !== 'string') {
      throw new Error('pnpm ls --json project without a name');
    }
    return name;
  });
}

/** Required member names absent from the install selection. */
export function missingFromClosure(
  required: readonly string[],
  selected: readonly string[],
): string[] {
  const installed = new Set(selected);
  return required.filter((name) => !installed.has(name)).sort();
}

/** Error text naming the members the filter leaves out. */
export function formatMissing(
  rule: ClosureRule,
  missing: readonly string[],
): string {
  return `${rule.need} outside RELEASE_CLOSURE: ${missing.join(', ')}: ${rule.why}`;
}
