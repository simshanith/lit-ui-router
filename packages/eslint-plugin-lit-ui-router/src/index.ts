// The `lit-ui-router/` eslint plugin (#659): rules that understand
// lit-ui-router directives. Private for now — the ship decision comes after
// the rules prove themselves in this repo's own lanes.
import type { Linter, Rule } from 'eslint';
import packageJson from '../package.json' with { type: 'json' };
import { anchorIsValid } from './anchor-is-valid.ts';

/** The plugin object shape; explicit so the dist d.ts is self-contained. */
export interface LitUiRouterPlugin {
  meta: { name: string; version: string };
  rules: Record<string, Rule.RuleModule>;
  configs: { recommended: Linter.Config[] };
}

const plugin: LitUiRouterPlugin = {
  meta: {
    name: packageJson.name,
    version: packageJson.version,
  },
  rules: {
    'anchor-is-valid': anchorIsValid,
  },
  // Self-referential (recommended registers the plugin), so it lands after
  // construction.
  configs: {} as { recommended: Linter.Config[] },
};

plugin.configs.recommended = [
  {
    name: 'lit-ui-router/recommended',
    plugins: { 'lit-ui-router': plugin },
    rules: {
      // The wrap replaces the base rule, so the host config must already
      // register lit-a11y — registering it here instead would collide with
      // the host's own instance of the plugin key.
      'lit-a11y/anchor-is-valid': 'off',
      'lit-ui-router/anchor-is-valid': 'error',
    },
  },
];

export default plugin;
