import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import packageJson from '../package.json' with { type: 'json' };
import plugin from './index.ts';
import { ruleUrl } from './rule-url.ts';
import { RULE_NAMES } from './rules.ts';

const DOCS = join(import.meta.dirname, '..', 'docs', 'rules');

void describe('ruleUrl', () => {
  void it('pins the docs to the tag this version releases as', () => {
    assert.equal(
      ruleUrl('sref-assign-href'),
      `https://github.com/simshanith/lit-ui-router/blob/eslint-plugin-lit-ui-router@${packageJson.version}/packages/eslint-plugin-lit-ui-router/docs/rules/sref-assign-href.md`,
    );
  });

  // A url that outlives the version reporting it is the failure this replaced.
  void it('names no branch', () => {
    assert.doesNotMatch(ruleUrl('anchor-is-valid'), /\/blob\/(main|master)\//);
  });
});

void describe('rule docs', () => {
  // Registering a rule without a url does not compile, and the name in one is
  // the rule's own. What is left to check is the string itself.
  void it('reaches every registered rule', () => {
    for (const name of RULE_NAMES) {
      assert.equal(plugin.rules[name].meta?.docs?.url, ruleUrl(name));
    }
  });

  void it('exists for every rule', () => {
    for (const name of RULE_NAMES) {
      assert.ok(
        existsSync(join(DOCS, `${name}.md`)),
        `${name} has no docs/rules/${name}.md, so its url would 404`,
      );
    }
  });
});
