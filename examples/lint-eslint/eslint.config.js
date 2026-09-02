import litA11y from 'eslint-plugin-lit-a11y';
import litUiRouter from 'eslint-plugin-lit-ui-router';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['node_modules/**'] },
  // syntax-only: the rule reads the template AST, never type information
  ...tseslint.configs.recommended,
  // ordering matters: ours turns lit-a11y/anchor-is-valid off in favor of it
  litA11y.configs.recommended,
  ...litUiRouter.configs.recommended,
];
