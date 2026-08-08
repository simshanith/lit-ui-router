// Every message a guard emits is prefixed with its name, so bind the name once
// rather than threading it through each retrieval call.
import { catalogRange, installedManifest } from './catalog.ts';

export interface Guard {
  /** Catalog range for a dep; fails when the catalog or the dep is absent. */
  range(catalog: string, dep: string): Promise<string>;
  /** Installed version of an aliased devDep; fails when it isn't installed. */
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
    installed(alias) {
      const manifest =
        installedManifest(alias) ??
        fail(
          `no ${alias} installed in ${process.cwd()}; run this guard from the ` +
            'package that declares the alias, and reinstall',
        );
      return (
        manifest.version ??
        fail(`${alias} in ${process.cwd()} has no version; reinstall`)
      );
    },
    pass: (message) => {
      console.log(`${name}: ${message}`);
    },
    fail,
  };
}
