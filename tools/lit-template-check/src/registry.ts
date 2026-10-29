// lit-analyzer's tag registry, narrowed to what a type can name from the end
// of the using file: a top-level class in that file, or an exported class in
// a file already in the same program. Event names need no type, so every
// definition in the program contributes them.
import { dirname, relative } from 'node:path';

import type { LocalEvents, LocalTag } from './prelude.ts';
import type { Definition } from './sites.ts';

export interface DefiningFile {
  path: string;
  definitions: Definition[];
}

export interface Registry {
  locals: LocalTag[];
  events: LocalEvents[];
  /** `path#tag` of definitions in the program whose class a type cannot reach. */
  unnameable: string[];
}

export function registryFor(
  path: string,
  defining: DefiningFile[],
  programFiles: ReadonlySet<string>,
): Registry {
  const registry: Registry = { locals: [], events: [], unnameable: [] };

  for (const file of defining) {
    if (file.path !== path && !programFiles.has(file.path)) continue;

    for (const definition of file.definitions) {
      if (definition.events.length > 0) {
        registry.events.push({
          tag: definition.tag,
          names: [...new Set(definition.events)],
        });
      }

      if (file.path === path && definition.topLevel) {
        registry.locals.push({
          tag: definition.tag,
          type: definition.className,
        });
        continue;
      }

      if (file.path === path || !definition.exported) {
        registry.unnameable.push(`${file.path}#${definition.tag}`);
        registry.locals.push({ tag: definition.tag });
        continue;
      }

      const specifier = relative(dirname(path), file.path).replace(
        /\.ts$/,
        '.js',
      );

      const module = specifier.startsWith('.') ? specifier : `./${specifier}`;

      registry.locals.push({
        tag: definition.tag,
        type: `import(${JSON.stringify(module)}).${definition.className}`,
      });
    }
  }

  return registry;
}
