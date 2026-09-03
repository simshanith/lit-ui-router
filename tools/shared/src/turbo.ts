// Read a package's turbo.json (JSONC) and return each task's dependsOn.
// The graph guards (docs:api producers, publishable packs) assert against
// package-qualified task edges here instead of manifest links, so a package
// can order on another's task without a workspace: dependency it never imports.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { type ParseError, parse, printParseErrorCode } from 'jsonc-parser';

export type TurboTaskDeps = Record<string, string[]>;

/** `{ task: dependsOn[] }` from `<dir>/turbo.json`; throws on missing or malformed. */
export function readTurboTaskDeps(dir: string): TurboTaskDeps {
  const path = join(dir, 'turbo.json');
  const errors: ParseError[] = [];
  const config: unknown = parse(readFileSync(path, 'utf8'), errors, {
    allowTrailingComma: true,
  });
  if (errors.length > 0) {
    const detail = errors
      .map((e) => `${printParseErrorCode(e.error)}@${e.offset}`)
      .join(', ');
    throw new Error(`${path}: ${detail}`);
  }
  const tasks =
    typeof config === 'object' && config !== null && 'tasks' in config
      ? (config as { tasks?: unknown }).tasks
      : undefined;
  if (typeof tasks !== 'object' || tasks === null) {
    throw new Error(`${path}: no tasks object`);
  }
  return Object.fromEntries(
    Object.entries(tasks).map(([task, def]) => {
      const dependsOn =
        typeof def === 'object' && def !== null && 'dependsOn' in def
          ? (def as { dependsOn?: unknown }).dependsOn
          : undefined;
      return [task, Array.isArray(dependsOn) ? dependsOn.map(String) : []];
    }),
  );
}
