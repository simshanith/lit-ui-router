// The `//#lint:complexity` lane: a hard ceiling no function passes, inline
// exceptions included. oxlint's `complexity` (.oxlintrc.json) is the gate a
// disable comment can waive; noInlineConfig makes those comments inert here.
import tsParser from '@tools/eslint-ts-parser';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(
  globalIgnores([
    '**/dist/**',
    'www/lit-ui-router.dev/api/**',
    'tools/release/.cache/**',
    '**/coverage/**',
    '**/node_modules/**',
    '**/.vitepress/cache/**',
    '**/.claude/**',
  ]),
  {
    files: ['**/*.{ts,mts,cts,tsx}'],
    languageOptions: { parser: tsParser },
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,tsx}'],
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'off',
    },
    rules: { complexity: ['error', { max: 25 }] },
  },
  {
    // Vendored from lit-a11y; kept in upstream's shape so re-syncs stay a diff.
    files: ['packages/eslint-plugin-lit-ui-router/src/anchor-is-valid.ts'],
    rules: { complexity: ['error', { max: 35 }] },
  },
);
