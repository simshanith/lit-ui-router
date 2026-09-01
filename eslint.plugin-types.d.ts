// eslint-plugin-lit-a11y ships no declarations (open-wc publishes it as plain JS).
declare module 'eslint-plugin-lit-a11y' {
  import type { Linter, Rule } from 'eslint';

  export const recommendedRules: Linter.RulesRecord;
  const plugin: {
    configs: { recommended: Linter.Config };
    rules: Record<string, Rule.RuleModule>;
  };
  export default plugin;
}

// eslint-rule-extender ships no declarations either. Narrowed to the one hook
// repo/anchor-is-valid uses: a report override that can drop a base rule's report.
declare module 'eslint-rule-extender' {
  import type { Rule } from 'eslint';

  interface ReportDescriptor {
    messageId?: string;
    loc?: {
      start: { line: number; column: number };
      end: { line: number; column: number };
    };
  }

  export default function ruleExtender(
    rule: Rule.RuleModule,
    options: {
      reportOverrides?: (
        descriptor: ReportDescriptor,
        context: Rule.RuleContext,
      ) => boolean | ReportDescriptor;
    },
  ): Rule.RuleModule;
}
