import litA11y from 'eslint-plugin-lit-a11y';
import litUiRouter from 'eslint-plugin-lit-ui-router';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['node_modules/**', 'dist/**', '**/*.d.ts'] },
  // syntax-only: the rule reads the template AST, never type information
  ...tseslint.configs.recommended,
  // ordering matters: ours turns lit-a11y/anchor-is-valid off in favor of it
  litA11y.configs.recommended,
  ...litUiRouter.configs.recommended,
  {
    // The violation gallery: recommended ships these at error, and the app
    // itself is held to that. Here they warn so the demo has output to show
    // without `npm run lint` exiting non-zero.
    files: ['src/violations.ts'],
    rules: {
      'lit-ui-router/anchor-is-valid': 'warn',
      'lit-ui-router/directive-position': 'warn',
      'lit-ui-router/sref-active-aria-current': 'warn',
      'lit-ui-router/sref-assign-href': 'warn',
    },
  },
];
