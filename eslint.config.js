import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import turbo from 'eslint-plugin-turbo';
import packageJson from 'eslint-plugin-package-json';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    extends: [packageJson.configs.recommended],
    files: ['package.json'],
    rules: {
      'package-json/require-description': [
        'error',
        {
          ignorePrivate: true,
        },
      ],
    },
  },
  prettier,
  {
    plugins: { turbo },
    rules: {
      'turbo/no-undeclared-env-vars': 'warn',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/.vitepress/cache/**',
      '**/*.config.ts',
      '**/*.config.js',
    ],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-redeclare': 'off',
      'no-prototype-builtins': 'off',
    },
  },
  {
    files: ['**/*.cy.js', '**/cypress/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        cy: 'readonly',
        Cypress: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        expect: 'readonly',
      },
    },
  },
  {
    files: ['**/*.spec.ts'],
    languageOptions: {
      parserOptions: {
        // Spec files are excluded from tsconfig.json for build purposes
        projectService: false,
      },
    },
    rules: {
      // Tests may use any for mocking
      '@typescript-eslint/no-explicit-any': 'off',
      // Allow underscore-prefixed unused vars (common pattern for required but unused params)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
