import { globSync } from 'node:fs';
import { join } from 'node:path';

import type { KnipConfiguration, WorkspaceProjectConfig } from 'knip';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import type { ExportsTarget, PackageManifest } from '@tools/bootstrap/types.ts';
import { isRootMember, loadWorkspace } from '@tools/shared/workspace.ts';

// oxc-emit compiles src/<stem>.ts to dist/<stem>.js, dist/<stem>.d.ts and,
// with --development, dist/development/<stem>.js.
const DIST_TARGET = /^\.\/dist\/(?:development\/)?/;

const EMITTED_EXTENSION = /(?:\.d)?\.(?:ts|js)$/;

/** An exports target that is a path, not conditions, a fallback list, or null. */
const isTargetPath = (target: ExportsTarget): target is string =>
  typeof target === 'string';

function targetPaths(target: ExportsTarget): string[] {
  if (isTargetPath(target)) return [target];

  if (target === null) return [];

  if (Array.isArray(target)) return target.flatMap(targetPaths);

  return Object.values(target).flatMap(targetPaths);
}

/**
 * The src/ files a manifest's dist/ exports compile from. knip maps dist/ back
 * to src/ only through a tsconfig `outDir`, and tsc emits nothing here.
 */
function distSourceEntries(manifest: PackageManifest): string[] {
  const entries = new Set<string>();

  for (const target of targetPaths(manifest.exports ?? null)) {
    // a wildcard passthrough names no file, as knip itself treats `./*`
    if (!DIST_TARGET.test(target) || target.includes('*')) continue;

    const stem = target.replace(DIST_TARGET, '').replace(EMITTED_EXTENSION, '');
    entries.add(`src/${stem}.ts`);
  }

  return [...entries];
}

// Type tests: the umbrella tsconfig compiles them, and nothing imports them.
const TYPE_TESTS = '**/*.types.ts';

function typeTestEntries(dir: string): string[] {
  const found = globSync(TYPE_TESTS, {
    cwd: dir,
    exclude: ['**/node_modules/**'],
  });

  return found.length > 0 ? [TYPE_TESTS] : [];
}

const workspaces = {
  '.': {
    ignoreDependencies: [
      // nothing scripts it; kept so `pnpm wrangler` works at the repo root
      'wrangler',
      // ad-hoc `pnpm lint:package-json --format tap` (docs/TURBO.md)
      'eslint-formatter-tap',
    ],
  },
  examples: {
    entry: ['*.test-d.ts'],
    // the tutorials are standalone npm projects with their own manifests
    ignore: ['*/**'],
  },
  'apps/sample-app-lit-e2e': {
    // reached from root mise tasks and `cypress --config-file`
    entry: ['scripts/*.ts', 'cypress*.config.ts', 'src/**/*.cy.{ts,js}'],
  },
  'packages/lit-ui-router': {
    // read by `cem analyze`, which knip has no plugin for
    entry: ['custom-elements-manifest.config.js'],
    ignoreDependencies: [
      // imported by the emitted dist, not by src
      '@oxc-project/runtime',
      // exact-pin alias pnpm dedupes the wide range onto (#454)
      'oxc-project-runtime',
      // release-it plugin, named in @tools/release-config's config
      '@release-it/conventional-changelog',
      // vitest alias target for the lit 2 compat lane
      'lit-2',
      // peer and dependency floor installs, bundled by check:bundle's peer lines
      '@uirouter/core-floor',
      '@oxc-project/runtime-floor',
    ],
  },
  'packages/lit-ui-router-effect': {
    ignoreDependencies: [
      '@release-it/conventional-changelog',
      'effect-3',
      'effect-floor',
      'lit-2',
      'lit-ui-router-floor',
      '@uirouter/core-floor',
    ],
  },
  'packages/lit-ui-router-mobx': {
    ignoreDependencies: [
      '@release-it/conventional-changelog',
      'lit-2',
      'mobx-6',
      'mobx-floor',
      'lit-ui-router-floor',
      '@uirouter/core-floor',
    ],
  },
  'packages/lit-ui-router-signals': {
    ignoreDependencies: [
      '@release-it/conventional-changelog',
      // vitest alias target for the lit 2 compat lane
      'lit-2',
      'lit-ui-router-floor',
      '@uirouter/core-floor',
    ],
  },
  'packages/lit-ui-router-ssr': {
    ignoreDependencies: [
      // imported by the emitted dist, not by src
      '@oxc-project/runtime',
      '@release-it/conventional-changelog',
      '@lit-labs/ssr-floor',
      '@lit-labs/ssr-client-floor',
      '@oxc-project/runtime-floor',
      '@uirouter/core-floor',
      'lit-ui-router-floor',
      'ui-router-server-floor',
      'ui-router-server-0.3-floor',
    ],
  },
  'packages/navigation-location-plugin': {
    ignoreDependencies: [
      '@release-it/conventional-changelog',
      '@uirouter/core-floor',
    ],
  },
  'packages/ui-router-effect': {
    ignoreDependencies: [
      '@release-it/conventional-changelog',
      // vitest alias target for the effect 3 compat lane
      'effect-3',
      'effect-floor',
      '@uirouter/core-floor',
    ],
  },
  'packages/ui-router-mobx': {
    ignoreDependencies: [
      '@release-it/conventional-changelog',
      // vitest alias target for the mobx 6 compat lane
      'mobx-6',
      'mobx-floor',
      '@uirouter/core-floor',
    ],
  },
  'packages/ui-router-signals': {
    ignoreDependencies: [
      '@release-it/conventional-changelog',
      '@uirouter/core-floor',
      'signal-polyfill-floor',
    ],
  },
  'packages/ui-router-server': {
    ignoreDependencies: [
      '@release-it/conventional-changelog',
      '@uirouter/core-floor',
      'hono-floor',
    ],
  },
  'packages/eslint-plugin-lit-ui-router': {
    ignoreDependencies: ['@release-it/conventional-changelog'],
    // oxlint fixture inputs, never imported
    ignore: ['test/oxlint/**/*.js'],
  },
  'tools/bundle-probe': {
    // bundled by path in free-of.test.ts, never imported
    entry: ['fixtures/*.ts'],
  },
  'tools/dts-backtest': {
    entry: ['fixtures/*.ts'],
    // the TS version matrix is imported by computed specifier
    ignoreDependencies: ['typescript-5.0', 'typescript-6', 'typescript-7'],
  },
  'tools/oxc-emit': {
    // reached via createRequire(), which knip does not follow
    ignoreDependencies: ['@ampproject/remapping'],
  },
  'tools/release': {
    // handed to pnpm by path as PNPM_CONFIG_PNPMFILE, never imported
    entry: ['src/steps/*.pnpmfile.mjs'],
  },
  'tools/shared': { entry: ['src/**/*.test-d.ts'] },
  'www/lit-ui-router.dev': {
    // is-server.ts is the wrangler alias target for lit-html/is-server.js
    entry: ['.vitepress/vite.config.ts', 'worker/is-server.ts'],
    // copied out of node_modules/<name>/dist by path in the vite config; cloudflare:workers is a workerd built-in
    ignoreDependencies: [
      'cloudflare',
      'sample-app-lit-vanilla',
      'sample-app-lit-mobx',
      'sample-app-lit-effect',
      'sample-app-lit-signals',
    ],
  },
  // cloudflare:workers is a workerd built-in, not a package
  'www/release-ledger.lit-ui-router.dev': {
    ignoreDependencies: ['cloudflare'],
  },
} satisfies Record<string, WorkspaceProjectConfig>;

export default async function config(): Promise<KnipConfiguration> {
  const { members } = await loadWorkspace(workspaceRoot);

  const merged = new Map<string, WorkspaceProjectConfig>(
    Object.entries(workspaces),
  );

  for (const member of members) {
    if (isRootMember(member) || !member.manifest) continue;

    const derived = [
      ...distSourceEntries(member.manifest),
      ...typeTestEntries(join(workspaceRoot, member.dir)),
    ];

    if (derived.length === 0) continue;

    const workspace = merged.get(member.dir) ?? {};

    merged.set(member.dir, {
      ...workspace,
      entry: [...derived, ...[workspace.entry ?? []].flat()],
    });
  }

  return {
    // The types the repo gates on. Unused exports, types and duplicates stay
    // off: the sample apps export every element twice by design, and the
    // export surface has not been reviewed against knip yet.
    include: [
      'files',
      'dependencies',
      'unlisted',
      'catalog',
      'catalogReferences',
    ],
    // an ignore that stops matching anything is a finding, not a comfort
    treatConfigHintsAsErrors: true,
    workspaces: Object.fromEntries(merged),
  };
}
