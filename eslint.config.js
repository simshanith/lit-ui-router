// ESLint lints manifests only: package.json (eslint-plugin-package-json,
// eslint-plugin-pnpm) and pnpm-workspace.yaml (eslint-plugin-pnpm).
// All JS/TS linting lives in oxlint (.oxlintrc.json).
import { defineConfig, globalIgnores } from 'eslint/config';
import oxlint from 'eslint-plugin-oxlint';
import packageJson from 'eslint-plugin-package-json';
import pluginPnpm from 'eslint-plugin-pnpm';

export default defineConfig(
  globalIgnores([
    '**/dist/**',
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
  pluginPnpm.configs.json,
  pluginPnpm.configs.yaml,
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
