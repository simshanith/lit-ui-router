import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import { srefActiveAriaCurrent } from './sref-active-aria-current.ts';

// RuleTester runs cases through these statics, which eslint's types omit.
const hooks = RuleTester as unknown as Record<string, unknown>;
hooks.describe = describe;
hooks.it = it;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

const IMPORTS = `
import { html } from 'lit';
import { uiSrefActive } from 'lit-ui-router';
`;

ruleTester.run('sref-active-aria-current', srefActiveAriaCurrent, {
  valid: [
    {
      name: 'no authored aria-current, so nothing is taken over',
      code: `${IMPORTS}html\`<a href="/home" \${uiSrefActive({})}>Home</a>\`;`,
    },
    {
      name: 'ariaCurrentValue: false hands the attribute back',
      code: `${IMPORTS}html\`<a href="/home" aria-current="page" \${uiSrefActive({ ariaCurrentValue: false })}>Home</a>\`;`,
    },
    {
      name: 'a non-literal params argument is unknowable',
      code: `${IMPORTS}const params = { ariaCurrentValue: false };\nhtml\`<a href="/home" aria-current="page" \${uiSrefActive(params)}>Home</a>\`;`,
    },
    {
      name: 'a non-literal ariaCurrentValue is unknowable',
      code: `${IMPORTS}html\`<a href="/home" aria-current="page" \${uiSrefActive({ ariaCurrentValue: choice })}>Home</a>\`;`,
    },
    {
      name: 'a spread could carry the opt-out, so it stays suppressed',
      code: `${IMPORTS}html\`<a href="/home" aria-current="page" \${uiSrefActive({ ...params })}>Home</a>\`;`,
    },
    {
      name: 'aria-current on a sibling element is not this element’s',
      code: `${IMPORTS}html\`<a href="/home" aria-current="page">Home</a><a href="/away" \${uiSrefActive({})}>Away</a>\`;`,
    },
    {
      name: "a foreign package's uiSrefActive is not ours",
      code: `import { html } from 'lit';\nimport { uiSrefActive } from 'other-router';\nhtml\`<a href="/home" aria-current="page" \${uiSrefActive({})}>Home</a>\`;`,
    },
  ],
  invalid: [
    {
      name: 'an empty params literal gains the opt-out',
      code: `${IMPORTS}html\`<a href="/home" aria-current="page" \${uiSrefActive({})}>Home</a>\`;`,
      errors: [{ messageId: 'ariaCurrentTakeover', data: { tag: 'a' } }],
      output: `${IMPORTS}html\`<a href="/home" aria-current="page" \${uiSrefActive({ ariaCurrentValue: false })}>Home</a>\`;`,
    },
    {
      name: 'no argument at all gains a params literal',
      code: `${IMPORTS}html\`<a href="/home" aria-current="page" \${uiSrefActive()}>Home</a>\`;`,
      errors: [{ messageId: 'ariaCurrentTakeover' }],
      output: `${IMPORTS}html\`<a href="/home" aria-current="page" \${uiSrefActive({ ariaCurrentValue: false })}>Home</a>\`;`,
    },
    {
      name: 'other params keys are left alone',
      code: `${IMPORTS}html\`<a href="/home" aria-current="page" \${uiSrefActive({ activeClasses: 'on' })}>Home</a>\`;`,
      errors: [{ messageId: 'ariaCurrentTakeover' }],
      output: `${IMPORTS}html\`<a href="/home" aria-current="page" \${uiSrefActive({ ariaCurrentValue: false, activeClasses: 'on' })}>Home</a>\`;`,
    },
    {
      name: 'an explicit non-false ariaCurrentValue still takes over, unfixed',
      code: `${IMPORTS}html\`<a href="/home" aria-current="page" \${uiSrefActive({ ariaCurrentValue: 'step' })}>Home</a>\`;`,
      errors: [{ messageId: 'ariaCurrentTakeover' }],
      output: null,
    },
    {
      name: 'a bound aria-current is authored too',
      code: `${IMPORTS}html\`<a href="/home" aria-current=\${current} \${uiSrefActive({})}>Home</a>\`;`,
      errors: [{ messageId: 'ariaCurrentTakeover' }],
      output: `${IMPORTS}html\`<a href="/home" aria-current=\${current} \${uiSrefActive({ ariaCurrentValue: false })}>Home</a>\`;`,
    },
    {
      name: 'an aliased uiSrefActive import still counts',
      code: `import { html } from 'lit';\nimport { uiSrefActive as active } from 'lit-ui-router';\nhtml\`<a href="/home" aria-current="page" \${active({})}>Home</a>\`;`,
      errors: [{ messageId: 'ariaCurrentTakeover' }],
      output: `import { html } from 'lit';\nimport { uiSrefActive as active } from 'lit-ui-router';\nhtml\`<a href="/home" aria-current="page" \${active({ ariaCurrentValue: false })}>Home</a>\`;`,
    },
    {
      name: 'a namespace import still counts',
      code: `import * as lit from 'lit';\nimport * as lur from 'lit-ui-router';\nlit.html\`<a href="/home" aria-current="page" \${lur.uiSrefActive({})}>Home</a>\`;`,
      errors: [{ messageId: 'ariaCurrentTakeover' }],
      output: `import * as lit from 'lit';\nimport * as lur from 'lit-ui-router';\nlit.html\`<a href="/home" aria-current="page" \${lur.uiSrefActive({ ariaCurrentValue: false })}>Home</a>\`;`,
    },
  ],
});

void describe('sref-active-aria-current meta', () => {
  void it('is fixable and takes no options', () => {
    assert.equal(srefActiveAriaCurrent.meta?.fixable, 'code');
    assert.deepEqual(srefActiveAriaCurrent.meta?.schema, []);
  });

  void it("mirrors the runtime warning's wording", () => {
    assert.match(
      srefActiveAriaCurrent.meta?.messages?.ariaCurrentTakeover ?? '',
      /removed when the state goes inactive.*ariaCurrentValue: false/,
    );
  });
});
