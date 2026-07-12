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
          // Mirror scripts/check-catalog.core.ts MANAGED_PREFIXES: aliases stay inline.
          allowedProtocols: ['workspace', 'link', 'file', 'portal', 'npm'],
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
