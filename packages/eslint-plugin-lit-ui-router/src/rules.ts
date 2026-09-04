import { anchorIsValid } from './anchor-is-valid.ts';
import { directivePosition } from './directive-position.ts';
import type { RegisteredRule, RuleFor } from './rule-shape.ts';
import { ruleUrl } from './rule-url.ts';
import { srefActiveAriaCurrent } from './sref-active-aria-current.ts';
import { srefAssignHref } from './sref-assign-href.ts';

// Spelled as data rather than read off the rule files, which export their own
// names: the dist d.ts is emitted by oxc's isolated declarations, which never
// resolves an import, so neither an array of the imported `RULE_NAME`s nor an
// object of the rules themselves has an inferable type. A literal list does, so
// the union is derived from this rather than restated — and each rule's
// `RuleFor<typeof RULE_NAME>` pins its own name to the key it is filed under.
/** Every rule this plugin ships. */
export const RULE_NAMES = [
  'anchor-is-valid',
  'directive-position',
  'sref-active-aria-current',
  'sref-assign-href',
] as const;

/** A rule this plugin ships. */
export type RuleName = (typeof RULE_NAMES)[number];

/** The rules as their files write them: declaring a name, carrying none. */
type Roster = { [Name in RuleName]: RuleFor<Name> };

/** The rules as the plugin registers them. */
type Registry = { [Name in RuleName]: RegisteredRule<Name> };

// Both the name and the url are attached from the key the rule is filed under,
// so neither can disagree with the name the plugin registers it as. The docs
// live on GitHub rather than beside the rule, so this is where the url belongs.
const register = <Name extends RuleName>(
  name: Name,
  rule: RuleFor<Name>,
): RegisteredRule<Name> => ({
  ...rule,
  name,
  meta: { ...rule.meta, docs: { ...rule.meta?.docs, url: ruleUrl(name) } },
});

// Applied to the roster whole, so a new rule cannot be registered undocumented.
// Iterating `RULE_NAMES` rather than the roster's own entries keeps each name's
// literal type, leaving only the assertion `Object.fromEntries` always costs;
// taking the roster as a type parameter pins that assertion to the keys it was
// handed rather than to the registry it is being used to build.
const registerAll = <Rules extends Roster>(
  rules: Rules,
): { [Name in keyof Rules]: RegisteredRule<Name & RuleName> } =>
  Object.fromEntries(
    RULE_NAMES.map((name) => [name, register(name, rules[name])]),
  ) as { [Name in keyof Rules]: RegisteredRule<Name & RuleName> };

// The roster, and the only place a rule meets the name it registers under.
// Keying each entry by `RuleFor<Name>` checks every way that can be wrong: a
// name with no rule, a rule under a name `RULE_NAMES` does not list, and a rule
// filed under another rule's name.
export const RULES: Registry = registerAll({
  'anchor-is-valid': anchorIsValid,
  'directive-position': directivePosition,
  'sref-active-aria-current': srefActiveAriaCurrent,
  'sref-assign-href': srefAssignHref,
});
