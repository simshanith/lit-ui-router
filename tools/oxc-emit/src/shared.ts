// Shared walk for the pass bins: a package's publishable sources, from the
// consuming package's root (src/**/*.ts minus specs and test helpers).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export const SRC = 'src';
export const OUT = 'dist';

export const fail = (file: string, errors: { message: string }[]): never => {
  throw new Error(
    `${file}: ${errors.map((error) => error.message).join('\n')}`,
  );
};

export function publishableSources(): string[] {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter(
      (file) =>
        file.endsWith('.ts') &&
        !file.endsWith('.spec.ts') &&
        // Test-only helpers, excluded alongside the specs that import them
        // (mirrors the packages' tsconfig.build excludes); inert when absent.
        !file.startsWith(join(SRC, 'specs')),
    );
}
