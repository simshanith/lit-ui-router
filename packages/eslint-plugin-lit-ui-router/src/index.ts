// The `lit-ui-router/` eslint plugin (#659): rules that understand
// lit-ui-router directives. Private for now — the ship decision comes after
// the rules prove themselves in this repo's own lanes.
import type { Linter } from 'eslint';
import packageJson from '../package.json' with { type: 'json' };
import type { RegisteredRule } from './rule-shape.ts';
import { RULES, type RuleName } from './rules.ts';

/** The plugin object shape; explicit so the dist d.ts is self-contained. */
export interface LitUiRouterPlugin {
  meta: { name: string; version: string };
  rules: { [Name in RuleName]: RegisteredRule<Name> };
  configs: { recommended: Linter.Config[] };
}

// Keyed by the roster, so recommended cannot silently omit a shipped rule.
const recommended: Record<`lit-ui-router/${RuleName}`, Linter.RuleEntry> = {
  'lit-ui-router/anchor-is-valid': 'error',
  'lit-ui-router/directive-position': 'error',
  'lit-ui-router/sref-active-aria-current': 'error',
  'lit-ui-router/sref-assign-href': 'error',
};

const plugin: LitUiRouterPlugin = {
  meta: {
    name: packageJson.name,
    version: packageJson.version,
  },
  rules: RULES,
  // Self-referential (recommended registers the plugin), so it lands after
  // construction.
  configs: {} as { recommended: Linter.Config[] },
};

plugin.configs.recommended = [
  {
    name: 'lit-ui-router/recommended',
    plugins: { 'lit-ui-router': plugin },
    rules: {
      // lit-a11y is an optional sibling now, not a peer: ours is vendored and
      // stands alone. This line displaces lit-a11y's rule for hosts that do
      // run it, and flat config accepts it inert when they don't.
      'lit-a11y/anchor-is-valid': 'off',
      ...recommended,
    },
  },
];

export default plugin;
