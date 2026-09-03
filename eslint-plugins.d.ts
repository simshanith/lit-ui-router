// eslint-plugin-lit-a11y ships no declarations (open-wc publishes it as plain
// JS). Lived in the plugin package's src until #676 vendored anchor-is-valid
// and dropped the dependency; eslint.config.ts is the only consumer left.
declare module 'eslint-plugin-lit-a11y' {
  import type { Linter, Rule } from 'eslint';

  export const recommendedRules: Linter.RulesRecord;
  const plugin: {
    configs: { recommended: Linter.Config };
    rules: Record<string, Rule.RuleModule>;
  };
  export default plugin;
}
