// Rule-authoring hygiene (#659): eslint-plugin-eslint-plugin over the plugin's
// own source, package-local so the root custom-element lane stays on theme.
// Deliberately NOT named eslint.config.*: eslint 10 resolves config per file
// from the nearest eslint.config.*, and a discoverable one here would shadow
// the root config for this whole directory — the package-json and elements
// lanes would silently skip the package. lint:rules passes it via --config.
// Plain .js: the eslint here is the 9.0.0 peer floor, which needs no loader.
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
