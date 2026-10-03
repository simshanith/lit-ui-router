import litUiRouter from 'eslint-plugin-lit-ui-router';
import tsParser from './lint/ts-parser/index.js';

export default [
  { ignores: ['node_modules/**', 'dist/**', 'dist-artifact/**', 'lint/**', 'public/**'] },
  // syntax-only: every rule reads the template AST, never type information
  { files: ['**/*.ts'], languageOptions: { parser: tsParser } },
  ...litUiRouter.configs.recommended,
];
