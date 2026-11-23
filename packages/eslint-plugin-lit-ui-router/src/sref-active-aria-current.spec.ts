import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import tsParser from '@tools/eslint-ts-parser';
import { RuleTester } from 'eslint';
import { srefActiveAriaCurrent } from './sref-active-aria-current.ts';

// RuleTester runs cases through these statics, which eslint's types omit.
Object.assign(RuleTester, { describe, it });

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

const IMPORTS = `
import { html } from 'lit';
import { srefAriaCurrent, uiSref, uiSrefActive } from 'lit-ui-router';
`;

/** A case for `element` (tag plus attributes) with uiSrefActive given `value` as its `ariaCurrentValue`. */
const objectForm = (name: string, element: string, value: string) => ({
  name,
  code: `${IMPORTS}html\`<${element} \${uiSrefActive({ ariaCurrentValue: ${value} })}></${element.split(' ')[0]}>\`;`,
});

// The object form, read the way the runtime resolves `{ exact, active }`.
const OBJECT_FORM_VALID = [
  objectForm(
    'object form: false on both keys never writes',
    'a href="/" aria-current="page"',
    '{ exact: false, active: false }',
  ),
  objectForm(
    'object form: an empty exact never writes, and active defaults off',
    'a href="/" aria-current="page"',
    "{ exact: '' }",
  ),
  objectForm(
    'object form: no keys off a link writes nothing',
    'li aria-current="step"',
    '{}',
  ),
  objectForm(
    'object form: a null exact falls back to no default off a link',
    'li aria-current="step"',
    '{ exact: null, active: null }',
  ),
  objectForm(
    'object form: a non-literal key is unknowable',
    'a href="/" aria-current="page"',
    '{ exact: choice, active: false }',
  ),
  objectForm(
    'object form: a spread could carry any key, so it stays suppressed',
    'a href="/" aria-current="page"',
    '{ ...values }',
  ),
  objectForm(
    'object form: a computed key could be either key, so it stays suppressed',
    'a href="/" aria-current="page"',
    '{ [key]: false }',
  ),
];

const OBJECT_FORM_INVALID = [
  objectForm(
    'object form: a literal exact takes over a non-link',
    'li aria-current="step"',
    "{ exact: 'page' }",
  ),
  objectForm(
    'object form: a literal active takes over a non-link',
    'li aria-current="step"',
    "{ exact: false, active: 'location' }",
  ),
  objectForm(
    "object form: an absent exact keeps the link's page default",
    'a href="/home" aria-current="page"',
    "{ active: 'location' }",
  ),
  objectForm(
    "object form: a null exact keeps the link's page default",
    'a href="/home" aria-current="page"',
    '{ exact: null }',
  ),
  objectForm(
    'object form: a literal key takes over beside an unknowable one',
    'li aria-current="step"',
    "{ exact: choice, active: 'location' }",
  ),
].map((test) => ({
  ...test,
  errors: [{ messageId: 'ariaCurrentTakeover' }],
  output: null,
}));

// A top-level `null` reads as omitted, as each object-form key does.
const NULL_VALID = [
  {
    name: 'a null ariaCurrentValue is omitted, so never writes on a non-link',
    code: `${IMPORTS}html\`<li aria-current="step" \${uiSrefActive({ ariaCurrentValue: null })}></li>\`;`,
  },
];

const NULL_INVALID = [
  {
    name: 'a null ariaCurrentValue is omitted, so a link takes the default and gains the opt-out',
    code: `${IMPORTS}html\`<a href="/" aria-current="page" \${uiSrefActive({ ariaCurrentValue: null })}>Home</a>\`;`,
    errors: [{ messageId: 'ariaCurrentTakeover', data: { tag: 'a' } }],
    output: `${IMPORTS}html\`<a href="/" aria-current="page" \${uiSrefActive({ ariaCurrentValue: false })}>Home</a>\`;`,
  },
];

const tsRuleTester = new RuleTester({
  languageOptions: { parser: tsParser, sourceType: 'module' },
});

tsRuleTester.run(
  'sref-active-aria-current (typescript-eslint)',
  srefActiveAriaCurrent,
  {
    valid: [
      ...OBJECT_FORM_VALID,
      ...NULL_VALID,
      objectForm(
        'object form: a cast is unknowable',
        'li aria-current="step"',
        "{ exact: 'page' } as AriaCurrentValues",
      ),
    ],
    invalid: [...OBJECT_FORM_INVALID, ...NULL_INVALID],
  },
);

ruleTester.run('sref-active-aria-current', srefActiveAriaCurrent, {
  valid: [
    ...OBJECT_FORM_VALID,
    ...NULL_VALID,
    {
      name: 'no authored aria-current, so nothing is taken over',
      code: `${IMPORTS}html\`<a href="/home" \${uiSrefActive({})}>Home</a>\`;`,
    },
    {
      name: 'srefAriaCurrent with no uiSrefActive beside it is nobody to take over',
      code: `${IMPORTS}html\`<a href="/home" aria-current=\${srefAriaCurrent({ state: 'home' })}>Home</a>\`;`,
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
    {
      name: 'non-link <li>: runtime default never writes aria-current, so no takeover',
      code: `${IMPORTS}html\`<li aria-current="step" \${uiSrefActive({ activeClasses: ['on'] })}><a \${uiSref('home')}>Home</a></li>\`;`,
    },
    {
      name: 'a non-link with no argument is never taken over',
      code: `${IMPORTS}html\`<li aria-current="step" \${uiSrefActive()}></li>\`;`,
    },
    {
      name: 'a role without the link token is not a link',
      code: `${IMPORTS}html\`<div role="button" aria-current="true" \${uiSrefActive({})}></div>\`;`,
    },
    {
      name: 'a declared link tag is still a non-link to the runtime default',
      code: `${IMPORTS}html\`<sp-link aria-current="page" \${uiSrefActive({})}></sp-link>\`;`,
      settings: { linkElements: ['sp-link'] },
    },
    {
      name: 'a bound role stays suppressed',
      code: `${IMPORTS}html\`<div role=\${role} aria-current="true" \${uiSrefActive({})}></div>\`;`,
    },
    {
      name: 'a partly bound role stays suppressed even with a static link token (conservative gap)',
      code: `${IMPORTS}html\`<div role="link \${extra}" aria-current="page" \${uiSrefActive({})}></div>\`;`,
    },
    {
      name: 'an empty ariaCurrentValue never writes, on a link',
      code: `${IMPORTS}html\`<a href="/" aria-current="page" \${uiSrefActive({ ariaCurrentValue: '' })}>Home</a>\`;`,
    },
    {
      name: 'an empty ariaCurrentValue never writes, on a non-link',
      code: `${IMPORTS}html\`<li aria-current="step" \${uiSrefActive({ ariaCurrentValue: '' })}></li>\`;`,
    },
  ],
  invalid: [
    ...OBJECT_FORM_INVALID,
    ...NULL_INVALID,
    {
      name: 'an explicit ariaCurrentValue takes over a non-link too, unfixed',
      code: `${IMPORTS}html\`<li aria-current="step" \${uiSrefActive({ ariaCurrentValue: 'step' })}></li>\`;`,
      errors: [{ messageId: 'ariaCurrentTakeover', data: { tag: 'li' } }],
      output: null,
    },
    {
      name: 'a literal role with the link token is a link',
      code: `${IMPORTS}html\`<div role="menuitem link" aria-current="page" \${uiSrefActive({})}></div>\`;`,
      errors: [{ messageId: 'ariaCurrentTakeover', data: { tag: 'div' } }],
      output: `${IMPORTS}html\`<div role="menuitem link" aria-current="page" \${uiSrefActive({ ariaCurrentValue: false })}></div>\`;`,
    },
    {
      name: '<area> is a native link',
      code: `${IMPORTS}html\`<area href="/home" aria-current="page" \${uiSrefActive()}>\`;`,
      errors: [{ messageId: 'ariaCurrentTakeover', data: { tag: 'area' } }],
      output: `${IMPORTS}html\`<area href="/home" aria-current="page" \${uiSrefActive({ ariaCurrentValue: false })}>\`;`,
    },
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
      name: 'an explicit string ariaCurrentValue still takes over, unfixed',
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
      name: 'a srefAriaCurrent binding is an authored aria-current like any other',
      code: `${IMPORTS}html\`<a href="/home" aria-current=\${srefAriaCurrent({ state: 'home' })} \${uiSrefActive({})}>Home</a>\`;`,
      errors: [{ messageId: 'ariaCurrentTakeover' }],
      output: `${IMPORTS}html\`<a href="/home" aria-current=\${srefAriaCurrent({ state: 'home' })} \${uiSrefActive({ ariaCurrentValue: false })}>Home</a>\`;`,
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
