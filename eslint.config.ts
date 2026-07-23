// ESLint lints manifests only: package.json (eslint-plugin-package-json,
// eslint-plugin-pnpm) and pnpm-workspace.yaml (eslint-plugin-pnpm).
// All JS/TS linting lives in oxlint (.oxlintrc.json).
import { defineConfig, globalIgnores } from 'eslint/config';
import oxlint from 'eslint-plugin-oxlint';
import packageJson from 'eslint-plugin-package-json';
import { configs as pnpmConfigs } from 'eslint-plugin-pnpm';
import repoRules from './eslint.repo-rules.ts';

export default defineConfig(
  globalIgnores([
    // build outputs (every output lives under a dist/ dir): parallel tasks
    // rewrite these mid-lint, so the **/package.json glob must never traverse them
    '**/dist/**',
    'docs/api/**',
    'tools/release/.cache/**',
    '**/coverage/**',
    '**/node_modules/**',
    '**/.vitepress/cache/**',
    '**/.claude/**',
  ]),
  {
    extends: [packageJson.configs.recommended],
    files: ['**/package.json'],
    rules: {
      'package-json/require-description': [
        'error',
        {
          ignorePrivate: true,
        },
      ],
    },
  },
  pnpmConfigs.json,
  pnpmConfigs.yaml,
  {
    files: ['**/package.json'],
    rules: {
      'pnpm/json-enforce-catalog': [
        'error',
        {
          // non-registry specs stay inline; npm: aliases belong in the catalog
          allowedProtocols: ['workspace', 'link', 'file', 'portal'],
          // report catalog-version conflicts instead of auto-creating a new catalog
          conflicts: 'error',
          fields: [
            'dependencies',
            'devDependencies',
            'peerDependencies',
            'optionalDependencies',
          ],
        },
      ],
      // autoInsert would fix a missing catalog entry by inventing ^0.0.0.
      'pnpm/json-valid-catalog': ['error', { autoInsert: false }],
    },
  },
  {
    // Root scripts must not execute another workspace package's files: the
    // owning package exposes a script and the root delegates (turbo run <task>
    // or pnpm --filter). scripts/** stays runnable — the root owns it.
    files: ['package.json'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'JSONProperty[key.value="scripts"] > JSONObjectExpression > JSONProperty > JSONLiteral[value=/\\b(?:node|tsx) +(?:\\.\\u002F)?(?:tools|packages|apps|docs|examples)\\u002F/]',
          message:
            "Cross-package execution: root scripts must not run another package's files with node/tsx. Add a script to the owning package and delegate via `turbo run <task>` (cached) or `pnpm --filter <pkg> run <script>` (uncached).",
        },
      ],
    },
  },
  {
    // The same boundary for every other package: scripts must not reach into
    // a sibling (or the root) by relative parent path. Own files run
    // directly; another package's entry points come through a workspace:*
    // dep's bin or a turbo/pnpm delegation.
    files: ['**/package.json'],
    ignores: ['package.json'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'JSONProperty[key.value="scripts"] > JSONObjectExpression > JSONProperty > JSONLiteral[value=/\\b(?:node|tsx) +\\.\\.\\u002F/]',
          message:
            'Cross-package execution: scripts must not run files outside their own package with node/tsx. Depend on the owning package (workspace:* bin) or delegate via `turbo run <task>` / `pnpm --filter <pkg> run <script>`.',
        },
      ],
    },
  },
  {
    // Shipped dep fields of publishable packages must not use workspace: refs:
    // pnpm's pack-substitution re-appends the substituted entry, breaking the
    // sorted published manifest. devDependencies is exempt (stripped at pack;
    // workspace:* is correct there), as are private manifests (never packed).
    files: ['packages/*/package.json'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'JSONObjectExpression:not(:has(> JSONProperty[key.value="private"][value.value=true])) > JSONProperty:matches([key.value="dependencies"], [key.value="peerDependencies"], [key.value="optionalDependencies"]) > JSONObjectExpression > JSONProperty > JSONLiteral[value=/^workspace:/]',
          message:
            'workspace: refs in shipped fields get pack-substituted with re-appended key order, breaking published-manifest sorting — use catalog:publishedPeer (or a version range) instead.',
        },
      ],
    },
  },
  {
    // Workspace members advertising dist-resolved types must pass-split their
    // build: turbo typecheck/lint depend on ^build:types only, so a dist-typed
    // package without one leaves dependents typechecking against a missing dist.
    // Src-exported types and buildless manifests are exempt by condition.
    files: [
      'packages/*/package.json',
      'apps/*/package.json',
      'tools/*/package.json',
      'docs/package.json',
      'examples/package.json',
    ],
    plugins: { repo: repoRules },
    rules: {
      'repo/require-build-types': 'error',
    },
  },
  {
    // examples/* are standalone `npm ci` projects (StackBlitz): inline versions required.
    files: ['examples/*/package.json'],
    rules: {
      'pnpm/json-enforce-catalog': 'off',
    },
  },
  {
    files: ['pnpm-workspace.yaml'],
    rules: {
      // name-only would flag the intentional publishedPeer/typescript6-compat/vitepress1 pins.
      'pnpm/yaml-no-duplicate-catalog-item': [
        'error',
        { checkDuplicates: 'exact-version' },
      ],
    },
  },
  // Keep last: disables any rules oxlint already enforces (no-op while eslint lints no JS/TS).
  oxlint.buildFromOxlintConfigFile('./.oxlintrc.json'),
);
