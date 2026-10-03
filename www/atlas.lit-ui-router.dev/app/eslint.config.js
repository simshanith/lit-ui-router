import tsParser from '@typescript-eslint/parser';
import litA11y from 'eslint-plugin-lit-a11y';
import oxlint from 'eslint-plugin-oxlint';

export default [
  { ignores: ['node_modules/**', 'dist/**', 'dist-artifact/**', 'public/**'] },
  // syntax-only: every rule reads the template AST, never type information
  { files: ['**/*.ts'], languageOptions: { parser: tsParser } },
  litA11y.configs.recommended,
  {
    // oxlint owns every lit-ui-router/* rule; this displaces lit-a11y's.
    rules: { 'lit-a11y/anchor-is-valid': 'off' },
  },
  ...oxlint.buildFromOxlintConfigFile('./.oxlintrc.json'),
];
