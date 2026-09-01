import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Linter } from 'eslint';
import litA11y from 'eslint-plugin-lit-a11y';
import packageJson from '../package.json' with { type: 'json' };
import plugin from './index.ts';

const IMPORTS = `
import { html } from 'lit';
import { uiSref } from 'lit-ui-router';
`;

// recommended expects the host config to register lit-a11y (a peer, shared
// instance) — mirror that here, as the root repo config does.
const config = [
  { files: ['**/*.ts'], plugins: { 'lit-a11y': litA11y } },
  ...plugin.configs.recommended,
];

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

  void it('recommended reports a dead anchor through the wrap, not the base rule', () => {
    const messages = lint(`${IMPORTS}html\`<a>Home</a>\`;`);
    assert.deepEqual(
      messages.map((message) => message.ruleId),
      ['lit-ui-router/anchor-is-valid'],
    );
  });

  void it('recommended stays quiet on a uiSref anchor', () => {
    assert.deepEqual(
      lint(`${IMPORTS}html\`<a \${uiSref('home')}>Home</a>\`;`),
      [],
    );
  });
});
