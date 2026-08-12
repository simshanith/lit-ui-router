// eslint-plugin-lit-a11y ships no declarations (open-wc publishes it as plain JS).
declare module 'eslint-plugin-lit-a11y' {
  import type { Linter } from 'eslint';

  export const recommendedRules: Linter.RulesRecord;
  const plugin: { configs: { recommended: Linter.Config } };
  export default plugin;
}
