// Every message a guard emits is prefixed with its name, so bind the name once
// rather than threading it through each retrieval call.
import { catalogRange, installedVersion } from './catalog.ts';

export interface Guard {
  /** Catalog range for a dep; fails when the catalog or the dep is absent. */
  range(catalog: string, dep: string): Promise<string>;
  installed(alias: string): string;
  pass(message: string): void;
  fail(message: string): never;
}

export function guard(name: string): Guard {
  const fail = (message: string): never => {
    throw new Error(`${name}: ${message}`);
  };
  return {
    async range(catalog, dep) {
      return (
        (await catalogRange(catalog, dep)) ??
        fail(`no ${catalog} ${dep} range in pnpm-workspace.yaml`)
      );
    },
    installed: installedVersion,
    pass: (message) => {
      console.log(`${name}: ${message}`);
    },
    fail,
  };
}
