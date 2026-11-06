// lit-analyzer's tag registry, narrowed to what a type can name from the end
// of the using file: a top-level class in that file, or an exported class in
// a file already in the same program. A tag defined more than once resolves
// to the definition the using file can see: its own, then one it imports.
import { dirname, relative } from 'node:path';

import type { LocalEvents, LocalTag } from './prelude.ts';
import type { Definition } from './sites.ts';

export interface DefiningFile {
  path: string;
  definitions: Definition[];
}

/** A second definition of a tag, a `customElements.define` clash if both load. */
export interface DuplicateTag {
  tag: string;
  path: string;
  start: number;
  /** File of the definition it repeats. */
  first: string;
}

export interface Registry {
  locals: LocalTag[];
  events: LocalEvents[];
  /** `path#tag` of definitions in the program whose class a type cannot reach. */
  unnameable: string[];
  duplicates: DuplicateTag[];
  /** `@slot` names of each tag whose class declares any. */
  slots: Map<string, string[]>;
}

interface Located {
  path: string;
  definition: Definition;
}

// own file, then imported files; with neither, every definition stays in
function visible(
  path: string,
  candidates: Located[],
  imports: ReadonlySet<string>,
): Located[] {
  if (candidates.length < 2) return candidates;
  const own = candidates.filter((candidate) => candidate.path === path);

  if (own.length > 0) return own;

  const imported = candidates.filter((candidate) =>
    imports.has(candidate.path),
  );

  return imported.length > 0 ? imported : candidates;
}

// one finding per extra definition, at the later one
function duplicatesOf([first, ...rest]: Located[]): DuplicateTag[] {
  return rest.map(({ path, definition }) => ({
    tag: definition.tag,
    path,
    start: definition.start,
    first: first.path,
  }));
}

function localFor(path: string, { path: file, definition }: Located) {
  if (file === path && definition.topLevel) {
    return { tag: definition.tag, type: definition.className };
  }

  if (file === path || !definition.exported) return { tag: definition.tag };

  const specifier = relative(dirname(path), file).replace(/\.ts$/, '.js');
  const module = specifier.startsWith('.') ? specifier : `./${specifier}`;

  return {
    tag: definition.tag,
    type: `import(${JSON.stringify(module)}).${definition.className}`,
  };
}

export function registryFor(
  path: string,
  defining: DefiningFile[],
  programFiles: ReadonlySet<string>,
  imports: ReadonlySet<string> = new Set(),
): Registry {
  const registry: Registry = {
    locals: [],
    events: [],
    unnameable: [],
    duplicates: [],
    slots: new Map(),
  };

  const byTag = new Map<string, Located[]>();

  for (const file of defining) {
    if (file.path !== path && !programFiles.has(file.path)) continue;

    for (const definition of file.definitions) {
      const located = byTag.get(definition.tag) ?? [];

      located.push({ path: file.path, definition });
      byTag.set(definition.tag, located);
    }
  }

  for (const [tag, candidates] of byTag) {
    registry.duplicates.push(...duplicatesOf(candidates));
    const shown = visible(path, candidates, imports);
    const names = new Set(shown.flatMap(({ definition }) => definition.events));

    if (names.size > 0) registry.events.push({ tag, names: [...names] });
    const slots = new Set(shown.flatMap(({ definition }) => definition.slots));

    if (slots.size > 0) registry.slots.set(tag, [...slots]);

    for (const located of shown) {
      const { definition } = located;
      const local = localFor(path, located);

      if (local.type === undefined) {
        registry.unnameable.push(`${located.path}#${definition.tag}`);
      }

      registry.locals.push(local);
    }
  }

  return registry;
}
