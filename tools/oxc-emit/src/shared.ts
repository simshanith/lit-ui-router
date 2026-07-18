import { globSync } from 'node:fs';

export const SRC = 'src';
export const OUT = 'dist';

export const fail = (file: string, errors: { message: string }[]): never => {
  throw new Error(
    `${file}: ${errors.map((error) => error.message).join('\n')}`,
  );
};

// From the consuming package's root; excludes mirror its tsconfig.build.
export function publishableSources(): string[] {
  return globSync(`${SRC}/**/*.ts`, {
    exclude: [`${SRC}/**/*.spec.ts`, `${SRC}/specs/**`],
  });
}
