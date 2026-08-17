// oxlint owns the inline `eslint-disable` directives under src, but ESLint 10
// hard-errors on a directive naming a rule it cannot resolve (linter.js
// createDisableDirectives) and offers no opt-out. These stubs define every
// namespaced rule .oxlintrc.json enables as a no-op so the directives parse;
// oxlint remains the only enforcer of them.
import type { ESLint, Rule } from 'eslint';
import { readFileSync } from 'node:fs';

interface OxlintConfig {
  rules?: Record<string, unknown>;
  overrides?: { rules?: Record<string, unknown> }[];
}

const config = JSON.parse(
  readFileSync(new URL('./.oxlintrc.json', import.meta.url), 'utf8'),
) as OxlintConfig;

const noop: Rule.RuleModule = { create: () => ({}) };

const plugins: Record<string, ESLint.Plugin> = {};
for (const ruleId of [
  ...Object.keys(config.rules ?? {}),
  ...(config.overrides ?? []).flatMap((o) => Object.keys(o.rules ?? {})),
]) {
  const separator = ruleId.lastIndexOf('/');
  if (separator === -1) continue;
  const namespace = ruleId.slice(0, separator);
  const name = ruleId.slice(separator + 1);
  // oxlint accepts the `@typescript-eslint` alias for its `typescript` plugin.
  for (const ns of namespace === 'typescript'
    ? [namespace, '@typescript-eslint']
    : [namespace]) {
    (plugins[ns] ??= { rules: {} }).rules![name] = noop;
  }
}

export default plugins;
