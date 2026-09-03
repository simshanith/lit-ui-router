import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Linter } from 'eslint';
import packageJson from '../package.json' with { type: 'json' };
import plugin from './index.ts';

const IMPORTS = `
import { html } from 'lit';
import { uiSref, uiSrefActive } from 'lit-ui-router';
`;

// No lit-a11y registered: the `off` line for it is inert, which is the whole
// point of the sibling shape (#676).
const config = [{ files: ['**/*.ts'] }, ...plugin.configs.recommended];

const lint = (code: string) =>
  new Linter().verify(code, config, 'component.ts');

void describe('plugin', () => {
  void it('meta names the package', () => {
    assert.deepEqual(plugin.meta, {
      name: packageJson.name,
      version: packageJson.version,
    });
  });

  void it('recommended registers the plugin it configures', () => {
    assert.equal(
      plugin.configs.recommended[0]?.plugins?.['lit-ui-router'],
      plugin,
    );
  });

  void it('recommended reports a dead anchor', () => {
    const messages = lint(`${IMPORTS}html\`<a>Home</a>\`;`);
    assert.deepEqual(
      messages.map((message) => message.ruleId),
      ['lit-ui-router/anchor-is-valid'],
    );
  });

  void it('recommended carries every rule the plugin ships', () => {
    const configured = Object.keys(
      plugin.configs.recommended[0]?.rules ?? {},
    ).filter((rule) => rule.startsWith('lit-ui-router/'));
    assert.deepEqual(
      configured.sort(),
      Object.keys(plugin.rules)
        .map((rule) => `lit-ui-router/${rule}`)
        .sort(),
    );
  });

  void it('recommended reports an href written to a <button>', () => {
    const messages = lint(
      `${IMPORTS}html\`<button \${uiSref('home')}>Home</button>\`;`,
    );
    assert.deepEqual(
      messages.map((message) => message.ruleId),
      ['lit-ui-router/sref-assign-href'],
    );
  });

  void it('recommended reports an aria-current takeover', () => {
    const messages = lint(
      `${IMPORTS}html\`<a href="/home" aria-current="page" \${uiSrefActive({})}>Home</a>\`;`,
    );
    assert.deepEqual(
      messages.map((message) => message.ruleId),
      ['lit-ui-router/sref-active-aria-current'],
    );
  });

  void it('recommended reports a directive outside an element part', () => {
    const messages = lint(
      `${IMPORTS}html\`<a href=\${uiSref('home')}>Home</a>\`;`,
    );
    assert.deepEqual(
      messages.map((message) => message.ruleId),
      ['lit-ui-router/directive-position'],
    );
  });

  void it('recommended stays quiet on a uiSref anchor', () => {
    assert.deepEqual(
      lint(`${IMPORTS}html\`<a \${uiSref('home')}>Home</a>\`;`),
      [],
    );
  });
});
