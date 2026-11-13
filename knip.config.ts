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

    // a non-JS asset such as custom-elements.json compiles from no src/ file
    if (!EMITTED_EXTENSION.test(target)) continue;

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
      // run ad hoc at the repo root; cf sites declare their own
      'cf',
      // Workers Builds runs `npx wrangler` from the repo root (tools/workers-builds/cloudflare-deploy.ts)
      'wrangler',
      // run ad hoc at the repo root (apps/sample-app-lit-e2e/README.md)
      '@playwright/cli',
      // ad-hoc `pnpm lint:package-json --format tap` (docs/TURBO.md)
      'eslint-formatter-tap',
      // knip applies root ignores to every workspace
      // floor-guard and check:bundle find <dep>-floor aliases by name; tsconfig paths read them by node_modules path
      /-floor$/,
      // compat lanes swap in <dep>-<major> through vitest aliases, tsconfig paths or a resolve hook, which knip doesn't count
      /^(?:lit-2|effect-3|mobx-6|vite-7)$/,
    ],
  },
  examples: {
    entry: ['*.test-d.ts'],
    // the tutorials are standalone npm projects with their own manifests
    ignore: ['*/**'],
  },
  'apps/sample-app-lit-vanilla': { entry: ['src/**/*.test-d.ts'] },
  'apps/sample-app-lit-signals': { entry: ['src/**/*.test-d.ts'] },
  'apps/sample-app-lit-effect': { entry: ['src/**/*.test-d.ts'] },
  'apps/sample-app-lit-mobx': { entry: ['src/**/*.test-d.ts'] },
  'apps/sample-app-lit-e2e': {
    // reached from root mise tasks
    entry: ['scripts/*.ts'],
  },
  'packages/lit-ui-router': {
    // read by `cem analyze`, which knip has no plugin for
    entry: ['custom-elements-manifest.config.js'],
    ignoreDependencies: [
      // imported by the emitted dist, not by src
      '@oxc-project/runtime',
      // exact-pin alias pnpm dedupes the wide range onto (#454)
      'oxc-project-runtime',
    ],
  },
  'packages/lit-ui-router-effect': { entry: ['test-d/*.test-d.ts'] },
  'packages/lit-ui-router-mobx': { entry: ['test-d/*.test-d.ts'] },
  'packages/lit-ui-router-signals': { entry: ['test-d/*.test-d.ts'] },
  'packages/lit-ui-router-ssr': {
    // imported by the emitted dist, not by src
    ignoreDependencies: ['@oxc-project/runtime'],
    // vite builds the fixture app from these by path, in vite-build.spec.ts
    entry: [
      'src/specs/vite-build/main.ts',
      'src/specs/vite-build/prerender*.ts',
    ],
  },
  'packages/ui-router-registry': {
    entry: ['src/specs/*.test-d.ts', 'test-d/**/*.test-d.ts'],
  },
  'packages/eslint-plugin-lit-ui-router': {
    // oxlint fixture inputs, never imported
    ignore: ['test/oxlint/**/*.js'],
  },
  'tools/bundle-probe': {
    // bundled by path in free-of.test.ts, never imported
    entry: ['fixtures/*.ts'],
  },
  'tools/doc-example-check': {
    // read by path in check.test.ts, never imported
    entry: ['fixtures/*.ts'],
  },
  'tools/dts-backtest': {
    entry: ['fixtures/*.ts', 'registered/*.ts', 'routed/**/*.ts'],
    // the TS version matrix is imported by computed specifier
    ignoreDependencies: ['typescript-5.0', 'typescript-6'],
  },
  'tools/lit-template-lint': {
    // checked by path in check.test.ts, never imported
    entry: ['src/fixtures/**/*.ts'],
    // reached via createRequire(), which knip does not follow
    ignoreDependencies: ['@vscode/web-custom-data'],
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
    // is-server.ts is the wrangler alias target for lit-html/is-server.js; VitePress loads each dynamic route's paths file
    entry: [
      '.vitepress/vite.config.ts',
      'worker/is-server.ts',
      'packages/**/*.paths.ts',
    ],
    // copied out of node_modules/<name>/dist by path in the vite config
    ignoreDependencies: [
      'sample-app-lit-vanilla',
      'sample-app-lit-mobx',
      'sample-app-lit-effect',
      'sample-app-lit-signals',
      // VitePress loads icon collections by the prefix in a VPIcon name
      '@iconify-json/lucide',
    ],
  },
  // knip has no cf plugin
  'www/release-diffs.lit-ui-router.dev': {
    entry: ['cloudflare.config.ts'],
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
