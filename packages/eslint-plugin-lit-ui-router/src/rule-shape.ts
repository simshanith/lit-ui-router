import type { Rule } from 'eslint';

/**
 * A rule as its file writes it: declaring the name it is registered under,
 * carrying it nowhere in the value.
 *
 * A rule file exports `RULE_NAME` and annotates itself `RuleFor<typeof
 * RULE_NAME>`, so the name is written once, as data. The annotation is required
 * regardless — the dist d.ts comes from oxc's isolated declarations, and an
 * unannotated export has no inferable type — so carrying the name in it is free.
 * `undefined` is common to both sides of an optional, so what the unset `name`
 * still rejects is the misfiling: `name?: 'a'` is not assignable to `name?: 'b'`.
 * A `Record<RuleName, Rule.RuleModule>` takes that, since every rule has the
 * same structural type.
 */
export type RuleFor<Name extends string> = Rule.RuleModule & { name?: Name };

/**
 * A rule as the registry files it: the name it was filed under, and the docs url
 * built from that name.
 *
 * Neither is written in the rule file, so neither can disagree with the name the
 * plugin registers. `meta.docs.url` is optional to eslint, so requiring it here
 * is what stops a rule from being registered without one.
 */
export type RegisteredRule<Name extends string> = Rule.RuleModule & {
  name: Name;
  meta: { docs: { url: string } };
};
