// Rule-authoring hygiene (#659): eslint-plugin-eslint-plugin over the plugin's
// own source, package-local so the root custom-element lane stays on theme.
// Plain .js: the eslint here is the 9.0.0 peer floor, which only loads
// eslint.config.{js,mjs,cjs}.
import tsParser from '@tools/eslint-ts-parser';
import eslintPluginPlugin from 'eslint-plugin-eslint-plugin';

export default [
  { ignores: ['dist/**'] },
  {
    ...eslintPluginPlugin.configs.recommended,
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
  },
];
