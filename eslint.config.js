// ESLint is retained solely for package.json linting (eslint-plugin-package-json).
// All JS/TS linting lives in oxlint (.oxlintrc.json).
import { defineConfig, globalIgnores } from 'eslint/config';
import packageJson from 'eslint-plugin-package-json';

export default defineConfig(
  globalIgnores([
    '**/dist/**',
    '**/coverage/**',
    '**/node_modules/**',
    '**/.vitepress/cache/**',
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
);
