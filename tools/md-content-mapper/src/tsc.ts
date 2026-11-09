import { fileURLToPath } from 'node:url';

/** The 7.1 beta's tsc; the content mapper protocol isn't in the repo-wide `typescript`. */
export const tsc: string = fileURLToPath(
  new URL('bin/tsc', import.meta.resolve('typescript-7.1/package.json')),
);
