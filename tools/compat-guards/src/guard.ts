// Every message a guard emits is prefixed with its name, so bind the name once
// rather than threading it through each retrieval call.
import { catalogRange, installedManifest } from './catalog.ts';
import { isReadableRange } from './ranges.ts';

export interface Guard {
  /**
   * Catalog range for a dep; fails when the catalog or the dep is absent, or
   * when the range isn't valid semver. Rejecting it here rather than letting a
   * predicate read it means a typo can't surface as a confident wrong answer.
   */
  range(catalog: string, dep: string): Promise<string>;
  /**
   * Installed version of an aliased devDep; fails when it isn't installed, or
   * when the alias resolved to a package other than `dep`. Pass the same `dep`
   * the range came from, so the alias is tied to the dependency just checked.
   */
  installed(alias: string, dep: string): string;
  pass(message: string): void;
  fail(message: string): never;
}

export function guard(name: string): Guard {
  const fail = (message: string): never => {
    throw new Error(`${name}: ${message}`);
  };
  return {
    async range(catalog, dep) {
      const range =
        (await catalogRange(catalog, dep)) ??
        fail(`no ${catalog} ${dep} range in pnpm-workspace.yaml`);
      if (!isReadableRange(range)) {
        fail(
          `${catalog} ${dep} range "${range}" is not a valid semver range. ` +
            'Fix it in pnpm-workspace.yaml.',
        );
      }
      return range;
    },
    installed(alias, dep) {
      const manifest =
        installedManifest(alias) ??
        fail(
          `no ${alias} installed in ${process.cwd()}; run this guard from the ` +
            'package that declares the alias, and reinstall',
        );
      // a mis-specified `npm:` target passes every version check but tests the
      // wrong package, so pin the alias to the dep whose range was just read
      if (manifest.name !== dep) {
        fail(
          `${alias} resolves to package ${manifest.name ?? '<unnamed>'}, not ` +
            `${dep}. Repoint the alias in pnpm-workspace.yaml and reinstall.`,
        );
      }
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
