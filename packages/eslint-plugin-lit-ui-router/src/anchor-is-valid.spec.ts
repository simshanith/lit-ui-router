import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import { anchorIsValid } from './anchor-is-valid.ts';

// RuleTester runs cases through these statics, which eslint's types omit.
Object.assign(RuleTester, { describe, it });

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

const IMPORTS = `
import { html } from 'lit';
import { srefHref, uiSref } from 'lit-ui-router';
`;

ruleTester.run('anchor-is-valid', anchorIsValid, {
  valid: [
    {
      name: 'uiSref part assigns an href at runtime',
      code: `${IMPORTS}html\`<a \${uiSref('home')}>Home</a>\`;`,
    },
    {
      name: 'srefHref binds the href itself, so the anchor is navigable',
      code: `${IMPORTS}html\`<a href=\${srefHref('users')}>Users</a>\`;`,
    },
    {
      name: 'srefHref beside a uiSref element part is still navigable',
      code: `${IMPORTS}html\`<a href=\${srefHref('users')} \${uiSref('users')}>Users</a>\`;`,
    },
    {
      name: "assignHref: 'auto' assigns on a native <a>",
      code: `${IMPORTS}html\`<a \${uiSref('home', undefined, { assignHref: 'auto' })}>Home</a>\`;`,
    },
    {
      name: 'non-literal assignHref is unknowable, so it stays suppressed',
      code: `${IMPORTS}const opt = { assignHref: false };\nhtml\`<a \${uiSref('home', undefined, opt)}>Home</a>\`;`,
    },
    {
      name: 'assignHref in params position is a state param, not the option — the default still assigns',
      code: `${IMPORTS}html\`<a \${uiSref('home', { assignHref: false })}>Home</a>\`;`,
    },
    {
      name: 'a static href needs no directive',
      code: `${IMPORTS}html\`<a href="/home">Home</a>\`;`,
    },
    {
      name: 'aliased html tag still counts',
      code: `import { html as h } from 'lit';\nimport { uiSref } from 'lit-ui-router';\nh\`<a \${uiSref('home')}>Home</a>\`;`,
    },
    {
      name: "options pass through: aspects without 'noHref' quiets a dead anchor",
      code: `${IMPORTS}html\`<a>Home</a>\`;`,
      options: [{ aspects: ['invalidHref'] }],
    },
    {
      name: 'namespace imports still count',
      code: `import * as lit from 'lit';\nimport * as lur from 'lit-ui-router';\nlit.html\`<a \${lur.uiSref('home')}>Home</a>\`;`,
    },
    {
      name: 'aliased uiSref import still counts',
      code: `import { html } from 'lit';\nimport { uiSref as sref } from 'lit-ui-router';\nhtml\`<a \${sref('home')}>Home</a>\`;`,
    },
  ],
  invalid: [
    {
      name: 'a dead anchor still reports',
      code: `${IMPORTS}html\`<a>Home</a>\`;`,
      errors: [{ messageId: 'noHrefErrorMessage' }],
    },
    {
      name: 'a bare hash is still an invalid href, placeholder guard or not',
      code: `${IMPORTS}html\`<a href="#">Home</a>\`;`,
      options: [{ allowHash: false }],
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
    },
    {
      name: 'a click-handler anchor without href still reports',
      code: `${IMPORTS}html\`<a @click=\${() => {}}>Home</a>\`;`,
      errors: [{ messageId: 'preferButtonErrorMessage' }],
    },
    {
      name: 'assignHref: false leaves the anchor dead — the base rule is right',
      code: `${IMPORTS}html\`<a \${uiSref('home', undefined, { assignHref: false })}>Home</a>\`;`,
      errors: [{ messageId: 'noHrefErrorMessage' }],
    },
    {
      name: "options pass through: an explicit 'noHref' aspect still reports",
      code: `${IMPORTS}html\`<a>Home</a>\`;`,
      options: [{ aspects: ['noHref'] }],
      errors: [{ messageId: 'noHrefErrorMessage' }],
    },
    {
      name: "a foreign package's uiSref proves nothing about this anchor",
      code: `import { html } from 'lit';\nimport { uiSref } from 'other-router';\nhtml\`<a \${uiSref('home')}>Home</a>\`;`,
      errors: [{ messageId: 'noHrefErrorMessage' }],
    },
    {
      name: 'a uiSref part on a non-anchor is not this rule’s business',
      code: `${IMPORTS}html\`<a \${uiSref('home')}></a><a></a>\`;`,
      errors: [{ messageId: 'noHrefErrorMessage' }],
    },
  ],
});

// `allowElementParts: false`: a server render never runs an element part, so
// only an href in the markup counts, and a lone uiSref is fixed to srefHref.
const SERVED = [{ allowElementParts: false }];

const SREF_ONLY = `
import { html } from 'lit';
import { uiSref } from 'lit-ui-router';
`;

ruleTester.run('anchor-is-valid (allowElementParts: false)', anchorIsValid, {
  valid: [
    {
      name: 'srefHref binds the href in the markup, so it is served',
      code: `${IMPORTS}html\`<a href=\${srefHref('users')}>Users</a>\`;`,
      options: SERVED,
    },
    {
      name: 'a static href is served as written',
      code: `${IMPORTS}html\`<a href="/home" \${uiSref('home')}>Home</a>\`;`,
      options: SERVED,
    },
    {
      name: 'allowElementParts: true is the default behaviour',
      code: `${IMPORTS}html\`<a \${uiSref('home')}>Home</a>\`;`,
      options: [{ allowElementParts: true }],
    },
    {
      name: 'an undeclared custom element is still not checked',
      code: `${IMPORTS}html\`<sp-link \${uiSref('home')}>Home</sp-link>\`;`,
      options: SERVED,
    },
  ],
  invalid: [
    {
      name: 'a uiSref element part is no href, and the fix binds srefHref',
      code: `${IMPORTS}html\`<a \${uiSref('home')}>Home</a>\`;`,
      options: SERVED,
      errors: [{ messageId: 'noHrefErrorMessage' }],
      output: `${IMPORTS}html\`<a href=\${srefHref('home')}>Home</a>\`;`,
    },
    {
      name: 'the fix adds srefHref to the import that has uiSref',
      code: `${SREF_ONLY}html\`<a \${uiSref('home')}>Home</a>\`;`,
      options: SERVED,
      errors: [{ messageId: 'noHrefErrorMessage' }],
      output: `
import { html } from 'lit';
import { uiSref, srefHref } from 'lit-ui-router';
html\`<a href=\${srefHref('home')}>Home</a>\`;`,
    },
    {
      name: 'an aliased srefHref import is reused under its own name',
      code: `import { html } from 'lit';\nimport { uiSref, srefHref as href } from 'lit-ui-router';\nhtml\`<a \${uiSref('home')}>Home</a>\`;`,
      options: SERVED,
      errors: [{ messageId: 'noHrefErrorMessage' }],
      output: `import { html } from 'lit';\nimport { uiSref, srefHref as href } from 'lit-ui-router';\nhtml\`<a href=\${href('home')}>Home</a>\`;`,
    },
    {
      name: 'a namespace import stays in its namespace',
      code: `import * as lit from 'lit';\nimport * as lur from 'lit-ui-router';\nlit.html\`<a \${lur.uiSref('home')}>Home</a>\`;`,
      options: SERVED,
      errors: [{ messageId: 'noHrefErrorMessage' }],
      output: `import * as lit from 'lit';\nimport * as lur from 'lit-ui-router';\nlit.html\`<a href=\${lur.srefHref('home')}>Home</a>\`;`,
    },
    {
      name: 'params and transition options carry over as written',
      code: `${IMPORTS}html\`<a class="nav" \${uiSref('users.detail', { id: 1 }, { inherit: false })}>User</a>\`;`,
      options: SERVED,
      errors: [{ messageId: 'noHrefErrorMessage' }],
      output: `${IMPORTS}html\`<a class="nav" href=\${srefHref('users.detail', { id: 1 }, { inherit: false })}>User</a>\`;`,
    },
    {
      name: 'assignHref: true is dropped, and the options object with it',
      code: `${IMPORTS}html\`<a \${uiSref('home', { id: 1 }, { assignHref: true })}>Home</a>\`;`,
      options: SERVED,
      errors: [{ messageId: 'noHrefErrorMessage' }],
      output: `${IMPORTS}html\`<a href=\${srefHref('home', { id: 1 })}>Home</a>\`;`,
    },
    {
      name: "assignHref: 'auto' is dropped, and an undefined params placeholder with it",
      code: `${IMPORTS}html\`<a \${uiSref('home', undefined, { assignHref: 'auto' })}>Home</a>\`;`,
      options: SERVED,
      errors: [{ messageId: 'noHrefErrorMessage' }],
      output: `${IMPORTS}html\`<a href=\${srefHref('home')}>Home</a>\`;`,
    },
    {
      name: 'assignHref is dropped from among other options',
      code: `${IMPORTS}html\`<a \${uiSref('home', {}, { assignHref: true, inherit: false })}>Home</a>\`;`,
      options: SERVED,
      errors: [{ messageId: 'noHrefErrorMessage' }],
      output: `${IMPORTS}html\`<a href=\${srefHref('home', {}, { inherit: false })}>Home</a>\`;`,
    },
    {
      name: 'assignHref is dropped as the last option too',
      code: `${IMPORTS}html\`<a \${uiSref('home', {}, { inherit: false, assignHref: 'auto' })}>Home</a>\`;`,
      options: SERVED,
      errors: [{ messageId: 'noHrefErrorMessage' }],
      output: `${IMPORTS}html\`<a href=\${srefHref('home', {}, { inherit: false })}>Home</a>\`;`,
    },
    {
      name: 'a click listener reports preferButton, with the same fix',
      code: `${IMPORTS}html\`<a @click=\${track} \${uiSref('home')}>Home</a>\`;`,
      options: SERVED,
      errors: [{ messageId: 'preferButtonErrorMessage' }],
      output: `${IMPORTS}html\`<a @click=\${track} href=\${srefHref('home')}>Home</a>\`;`,
    },
    {
      name: 'a non-literal options argument is unknowable, so it reports unfixed',
      code: `${IMPORTS}const opt = {};\nhtml\`<a \${uiSref('home', undefined, opt)}>Home</a>\`;`,
      options: SERVED,
      errors: [{ messageId: 'noHrefErrorMessage' }],
      output: null,
    },
    {
      name: 'a spread in the options reports unfixed',
      code: `${IMPORTS}html\`<a \${uiSref('home', undefined, { ...opt })}>Home</a>\`;`,
      options: SERVED,
      errors: [{ messageId: 'noHrefErrorMessage' }],
      output: null,
    },
    {
      name: 'a spread argument reports unfixed',
      code: `${IMPORTS}html\`<a \${uiSref(...args)}>Home</a>\`;`,
      options: SERVED,
      errors: [{ messageId: 'noHrefErrorMessage' }],
      output: null,
    },
    {
      name: 'a non-literal assignHref reports unfixed',
      code: `${IMPORTS}html\`<a \${uiSref('home', undefined, { assignHref: mode })}>Home</a>\`;`,
      options: SERVED,
      errors: [{ messageId: 'noHrefErrorMessage' }],
      output: null,
    },
    {
      name: 'assignHref: false wrote no href before, so it reports unfixed',
      code: `${IMPORTS}html\`<a \${uiSref('home', undefined, { assignHref: false })}>Home</a>\`;`,
      options: SERVED,
      errors: [{ messageId: 'noHrefErrorMessage' }],
      output: null,
    },
    {
      name: 'two uiSref parts on one anchor report unfixed',
      code: `${IMPORTS}html\`<a \${uiSref('home')} \${uiSref('users')}>Home</a>\`;`,
      options: SERVED,
      errors: [{ messageId: 'noHrefErrorMessage' }],
      output: null,
    },
    {
      name: 'a declared link element is fixed the way an <a> is',
      code: `${IMPORTS}html\`<sp-link \${uiSref('home')}>Home</sp-link>\`;`,
      options: [{ allowElementParts: false, linkElements: ['sp-link'] }],
      errors: [{ messageId: 'noHrefErrorMessage' }],
      output: `${IMPORTS}html\`<sp-link href=\${srefHref('home')}>Home</sp-link>\`;`,
    },
    {
      name: "'auto' writes no href to a declared link element, so it reports unfixed",
      code: `${IMPORTS}html\`<sp-link \${uiSref('home', undefined, { assignHref: 'auto' })}>Home</sp-link>\`;`,
      options: [{ allowElementParts: false, linkElements: ['sp-link'] }],
      errors: [{ messageId: 'noHrefErrorMessage' }],
      output: null,
    },
  ],
});

// `settings.allowElementParts`: shared by both element-part rules, and an
// `allowElementParts` option on the rule replaces it.
const servedTester = new RuleTester({
  settings: { allowElementParts: false },
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

servedTester.run(
  'anchor-is-valid (settings.allowElementParts: false)',
  anchorIsValid,
  {
    valid: [
      {
        name: 'the option replaces the setting for this rule',
        code: `${IMPORTS}html\`<a \${uiSref('home')}>Home</a>\`;`,
        options: [{ allowElementParts: true }],
      },
      {
        name: 'other options leave the setting in force, and srefHref still counts',
        code: `${IMPORTS}html\`<a href=\${srefHref('home')}>Home</a>\`;`,
        options: [{ allowHash: false }],
      },
    ],
    invalid: [
      {
        name: 'the setting alone reports and fixes as the option does',
        code: `${IMPORTS}html\`<a \${uiSref('home')}>Home</a>\`;`,
        errors: [{ messageId: 'noHrefErrorMessage' }],
        output: `${IMPORTS}html\`<a href=\${srefHref('home')}>Home</a>\`;`,
      },
      {
        name: 'the setting holds beside other options',
        code: `${IMPORTS}html\`<a \${uiSref('home')}>Home</a>\`;`,
        options: [{ linkElements: ['sp-link'] }],
        errors: [{ messageId: 'noHrefErrorMessage' }],
        output: `${IMPORTS}html\`<a href=\${srefHref('home')}>Home</a>\`;`,
      },
    ],
  },
);

const clientTester = new RuleTester({
  settings: { allowElementParts: true },
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

clientTester.run(
  'anchor-is-valid (settings.allowElementParts: true)',
  anchorIsValid,
  {
    valid: [
      {
        name: 'the setting credits the element part',
        code: `${IMPORTS}html\`<a \${uiSref('home')}>Home</a>\`;`,
      },
    ],
    invalid: [
      {
        name: 'the option replaces the setting for this rule',
        code: `${IMPORTS}html\`<a \${uiSref('home')}>Home</a>\`;`,
        options: SERVED,
        errors: [{ messageId: 'noHrefErrorMessage' }],
        output: `${IMPORTS}html\`<a href=\${srefHref('home')}>Home</a>\`;`,
      },
    ],
  },
);

const malformedTester = new RuleTester({
  settings: { allowElementParts: 'false' },
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

malformedTester.run(
  'anchor-is-valid (settings.allowElementParts malformed)',
  anchorIsValid,
  {
    valid: [
      {
        name: 'a non-boolean setting is no declaration, so the default holds',
        code: `${IMPORTS}html\`<a \${uiSref('home')}>Home</a>\`;`,
      },
    ],
    invalid: [],
  },
);

// `linkElements` (#676): declaring a tag is what makes it visible to this rule.
ruleTester.run('anchor-is-valid (linkElements undeclared)', anchorIsValid, {
  valid: [
    {
      name: 'a design-system link is invisible with no declaration anywhere',
      code: `${IMPORTS}html\`<sp-link>Home</sp-link>\`;`,
    },
    {
      name: 'an empty declaration is no declaration',
      code: `${IMPORTS}html\`<sp-link>Home</sp-link>\`;`,
      options: [{ linkElements: [] }],
    },
    {
      name: 'declaring one tag says nothing about another',
      code: `${IMPORTS}html\`<sp-button>Home</sp-button>\`;`,
      options: [{ linkElements: ['sp-link'] }],
    },
  ],
  invalid: [
    {
      name: 'the rule option alone declares a link element',
      code: `${IMPORTS}html\`<sp-link>Home</sp-link>\`;`,
      options: [{ linkElements: ['sp-link'] }],
      errors: [{ messageId: 'noHrefErrorMessage' }],
    },
    {
      name: 'a declared link element is checked as an <a> is',
      code: `${IMPORTS}html\`<sp-link href="">Home</sp-link>\`;`,
      options: [{ linkElements: ['sp-link'] }],
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
    },
    {
      name: 'aspects still apply to a declared link element',
      code: `${IMPORTS}html\`<sp-link @click=\${() => {}}>Home</sp-link>\`;`,
      options: [{ linkElements: ['sp-link'] }],
      errors: [{ messageId: 'preferButtonErrorMessage' }],
    },
    {
      name: 'a declaration is matched lowercased, as parse5 reports tags',
      code: `${IMPORTS}html\`<sp-link>Home</sp-link>\`;`,
      options: [{ linkElements: ['SP-Link'] }],
      errors: [{ messageId: 'noHrefErrorMessage' }],
    },
  ],
});

const declaredTester = new RuleTester({
  settings: { linkElements: ['sp-link'] },
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

declaredTester.run('anchor-is-valid (linkElements declared)', anchorIsValid, {
  valid: [
    {
      name: 'the shared setting alone declares a link element, and uiSref answers it',
      code: `${IMPORTS}html\`<sp-link \${uiSref('home')}>Home</sp-link>\`;`,
    },
    {
      name: 'a static href satisfies a declared link element too',
      code: `${IMPORTS}html\`<sp-link href="/home">Home</sp-link>\`;`,
    },
    {
      name: 'the rule option replaces the setting wholesale',
      code: `${IMPORTS}html\`<sp-link>Home</sp-link>\`;`,
      options: [{ linkElements: ['sp-button'] }],
    },
    {
      name: 'an empty rule option replaces the setting with nothing',
      code: `${IMPORTS}html\`<sp-link>Home</sp-link>\`;`,
      options: [{ linkElements: [] }],
    },
    {
      name: 'the setting leaves undeclared elements alone',
      code: `${IMPORTS}html\`<sp-button>Home</sp-button>\`;`,
    },
    {
      name: 'the setting leaves native non-links alone',
      code: `${IMPORTS}html\`<div>Home</div>\`;`,
    },
  ],
  invalid: [
    {
      name: 'the shared setting alone declares a link element',
      code: `${IMPORTS}html\`<sp-link>Home</sp-link>\`;`,
      errors: [{ messageId: 'noHrefErrorMessage' }],
    },
    {
      name: "'auto' writes no href to a declared link element, so it stays dead",
      code: `${IMPORTS}html\`<sp-link \${uiSref('home', undefined, { assignHref: 'auto' })}>Home</sp-link>\`;`,
      errors: [{ messageId: 'noHrefErrorMessage' }],
    },
    {
      name: 'assignHref: false is a definite no on a declared link element too',
      code: `${IMPORTS}html\`<sp-link \${uiSref('home', undefined, { assignHref: false })}>Home</sp-link>\`;`,
      errors: [{ messageId: 'noHrefErrorMessage' }],
    },
    {
      name: 'the rule option replaces the setting, declaring another tag',
      code: `${IMPORTS}html\`<sp-button>Home</sp-button>\`;`,
      options: [{ linkElements: ['sp-button'] }],
      errors: [{ messageId: 'noHrefErrorMessage' }],
    },
    {
      name: '<a> is still checked alongside a declaration',
      code: `${IMPORTS}html\`<a>Home</a>\`;`,
      errors: [{ messageId: 'noHrefErrorMessage' }],
    },
  ],
});

// `litHtmlSources` gating, vendored from lit-a11y's HasLitHtmlImportRuleExtension:
// an array setting means "only analyse files that import one of these".
const gatedTester = new RuleTester({
  settings: { litHtmlSources: ['my-lit'] },
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

gatedTester.run('anchor-is-valid (litHtmlSources array)', anchorIsValid, {
  valid: [
    {
      name: 'no lit-html import at all, so the file is not analysed',
      code: "import { foo } from 'unrelated';\nhtml`<a></a>`;",
    },
  ],
  invalid: [
    {
      name: 'a default source still gates the file in',
      code: "import { html } from 'lit';\nhtml`<a></a>`;",
      errors: [{ messageId: 'noHrefErrorMessage' }],
    },
    {
      name: "the user's own source gates the file in",
      code: "import { html } from 'my-lit';\nhtml`<a></a>`;",
      errors: [{ messageId: 'noHrefErrorMessage' }],
    },
  ],
});

// Parity guard: eslint-plugin-lit-a11y 5.1.1's own
// tests/lib/rules/anchor-is-valid.js, ported verbatim. Only the rule name and
// the tester plumbing change — every messageId stays what upstream expects.
const upstreamTester = new RuleTester({
  settings: { litHtmlSources: false },
  languageOptions: {
    parserOptions: { sourceType: 'module', ecmaVersion: 2015 },
  },
});

upstreamTester.run('anchor-is-valid (lit-a11y parity)', anchorIsValid, {
  valid: [
    { code: 'html`<a href="foo"></a>`' },
    { code: 'html`<a href=${foo}></a>`' },
    { code: 'html`<a href="/foo"></a>`' },
    { code: 'html`<a href="https://foo.bar.com"></a>`' },
    { code: 'html`<div href="foo"></div>`' },
    { code: 'html`<a href="javascript"></a>`' },
    { code: 'html`<a href="javascriptFoo"></a>`' },
    { code: 'html`<a href="#"></a>`' },
    { code: 'html`<a href="#foo"></a>`' },
    { code: 'html`<a href="#javascript"></a>`' },
    { code: 'html`<a href="#javascriptFoo"></a>`' },

    { code: 'html`<a href="foo" @click=${foo}></a>`' },
    { code: 'html`<a href=${foo} @click=${foo}></a>`' },
    { code: 'html`<a href="/foo" @click=${foo}></a>`' },
    { code: 'html`<a href="https://foo.bar.com" @click=${foo}></a>`' },
    { code: 'html`<div href="foo" @click=${foo}></div>`' },
    { code: 'html`<a href=${`#foo`} @click=${foo}></a>`' },
    { code: 'html`<a href="#foo" @click=${foo}></a>`' },

    {
      code: 'html`<a href=""></a>;`',
      options: [{ aspects: ['preferButton'] }],
    },
    { code: 'html`<a href="#"></a>`', options: [{ aspects: ['invalidHref'] }] },
    {
      code: 'html`<a href="${\'#\'}"></a>`',
      options: [{ aspects: ['invalidHref'] }],
    },
    {
      code: 'html`<a href="#"></a>`',
      options: [{ aspects: ['preferButton'] }],
    },
    {
      code: "html`<a href=${'#'}></a>`",
      options: [{ aspects: ['preferButton'] }],
    },
    {
      code: 'html`<a href="javascript:void(0)"></a>`',
      options: [{ aspects: ['preferButton'] }],
    },
    {
      code: 'html`<a href=${"javascript:void(0)"}></a>`',
      options: [{ aspects: ['preferButton'] }],
    },
    { code: 'html`<a href=""></a>;`', options: [{ aspects: ['noHref'] }] },
    { code: 'html`<a href="#"></a>`', options: [{ aspects: ['noHref'] }] },
    { code: "html`<a href=${'#'}></a>`", options: [{ aspects: ['noHref'] }] },
    {
      code: 'html`<a href="javascript:void(0)"></a>`',
      options: [{ aspects: ['noHref'] }],
    },
    {
      code: 'html`<a href=${"javascript:void(0)"}></a>`',
      options: [{ aspects: ['noHref'] }],
    },
    {
      code: 'html`<a href=""></a>;`',
      options: [{ aspects: ['noHref', 'preferButton'] }],
    },
    {
      code: 'html`<a href="#"></a>`',
      options: [{ aspects: ['noHref', 'preferButton'] }],
    },
    {
      code: "html`<a href=${'#'}></a>`",
      options: [{ aspects: ['noHref', 'preferButton'] }],
    },
    {
      code: 'html`<a href="javascript:void(0)"></a>`',
      options: [{ aspects: ['noHref', 'preferButton'] }],
    },
    {
      code: 'html`<a href=${"javascript:void(0)"}></a>`',
      options: [{ aspects: ['noHref', 'preferButton'] }],
    },

    {
      code: 'html`<a @click=${foo}></a>`',
      options: [{ aspects: ['invalidHref'] }],
    },
    {
      code: 'html`<a href="#" @click=${foo}></a>`',
      options: [{ aspects: ['invalidHref'] }],
    },
    {
      code: 'html`<a href="${\'#\'}" @click=${foo}></a>`',
      options: [{ aspects: ['invalidHref'] }],
    },
    {
      code: 'html`<a href="#" @click=${foo}></a>`',
      options: [{ aspects: ['noHref'] }],
    },
    {
      code: 'html`<a href="javascript:void(0)" @click=${foo}></a>`',
      options: [{ aspects: ['noHref'] }],
    },
    {
      code: 'html`<a href=${"javascript:void(0)"} @click=${foo}></a>`',
      options: [{ aspects: ['noHref'] }],
    },
    // HREF PROPERTY
    { code: 'html`<a .href=${foo}></a>`' },
    { code: 'html`<a .href=${foo} @click=${foo}></a>`' },
    { code: 'html`<a .href=${`#foo`} @click=${foo}></a>`' },

    {
      code: 'html`<a .href=${""}></a>;`',
      options: [{ aspects: ['preferButton'] }],
    },
    {
      code: 'html`<a .href=${"#"}></a>`',
      options: [{ aspects: ['invalidHref'] }],
    },
    {
      code: 'html`<a .href=${"#"}></a>`',
      options: [{ aspects: ['preferButton'] }],
    },
    {
      code: 'html`<a .href=${"javascript:void(0)"}></a>`',
      options: [{ aspects: ['preferButton'] }],
    },
    { code: 'html`<a .href=${""}></a>;`', options: [{ aspects: ['noHref'] }] },
    { code: 'html`<a .href=${"#"}></a>`', options: [{ aspects: ['noHref'] }] },
    {
      code: 'html`<a .href=${"javascript:void(0)"}></a>`',
      options: [{ aspects: ['noHref'] }],
    },
    {
      code: 'html`<a .href=${""}></a>;`',
      options: [{ aspects: ['noHref', 'preferButton'] }],
    },
    {
      code: "html`<a .href=${'#'}></a>`",
      options: [{ aspects: ['noHref', 'preferButton'] }],
    },
  ],

  invalid: [
    { code: 'html`<a></a>`', errors: [{ messageId: 'noHrefErrorMessage' }] },
    // INVALID HREF
    {
      code: 'html`<a href=""></a>;`',
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
    },
    {
      code: 'html`<a href="#"></a>`',
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
      options: [{ allowHash: false }],
    },
    {
      code: 'html`<a href="javascript:void(0)"></a>`',
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
    },
    // SHOULD BE BUTTON
    {
      code: 'html`<a @click=${foo}></a>`',
      errors: [{ messageId: 'preferButtonErrorMessage' }],
    },
    {
      code: 'html`<a href="#" @click=${foo}></a>`',
      errors: [{ messageId: 'preferButtonErrorMessage' }],
      options: [{ allowHash: false }],
    },
    {
      code: 'html`<a href="javascript:void(0)" @click=${foo}></a>`',
      errors: [{ messageId: 'preferButtonErrorMessage' }],
    },

    // WITH ASPECTS TESTS
    // NO HREF
    {
      code: 'html`<a></a>`',
      options: [{ aspects: ['noHref'] }],
      errors: [{ messageId: 'noHrefErrorMessage' }],
    },
    {
      code: 'html`<a></a>`',
      options: [{ aspects: ['noHref', 'preferButton'] }],
      errors: [{ messageId: 'noHrefErrorMessage' }],
    },
    {
      code: 'html`<a></a>`',
      options: [{ aspects: ['noHref', 'invalidHref'] }],
      errors: [{ messageId: 'noHrefErrorMessage' }],
    },

    // INVALID HREF
    {
      code: 'html`<a href=""></a>;`',
      options: [{ aspects: ['invalidHref'] }],
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
    },
    {
      code: 'html`<a href=""></a>;`',
      options: [{ aspects: ['noHref', 'invalidHref'] }],
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
    },
    {
      code: 'html`<a href=""></a>;`',
      options: [{ aspects: ['preferButton', 'invalidHref'] }],
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
    },
    {
      code: 'html`<a href="#"></a>;`',
      options: [{ aspects: ['invalidHref'], allowHash: false }],
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
    },
    {
      code: 'html`<a href="${\'#\'}">inf</a>;`',
      options: [{ aspects: ['invalidHref'], allowHash: false }],
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
    },
    {
      code: 'html`<a href="#"></a>;`',
      options: [{ aspects: ['noHref', 'invalidHref'], allowHash: false }],
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
    },
    {
      code: 'html`<a href="${\'#\'}"></a>;`',
      options: [{ aspects: ['noHref', 'invalidHref'], allowHash: false }],
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
    },
    {
      code: 'html`<a href="#"></a>;`',
      options: [{ aspects: ['preferButton', 'invalidHref'], allowHash: false }],
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
    },
    {
      code: 'html`<a href="${\'#\'}"></a>;`',
      options: [{ aspects: ['preferButton', 'invalidHref'], allowHash: false }],
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
    },
    {
      code: 'html`<a href="javascript:void(0)"></a>;`',
      options: [{ aspects: ['invalidHref'] }],
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
    },
    {
      code: 'html`<a href="javascript:void(0)"></a>;`',
      options: [{ aspects: ['noHref', 'invalidHref'] }],
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
    },
    {
      code: 'html`<a href="javascript:void(0)"></a>;`',
      options: [{ aspects: ['preferButton', 'invalidHref'] }],
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
    },

    // SHOULD BE BUTTON
    {
      code: 'html`<a @click=${foo}></a>`',
      options: [{ aspects: ['preferButton'] }],
      errors: [{ messageId: 'preferButtonErrorMessage' }],
    },
    {
      code: 'html`<a @click=${foo}></a>`',
      options: [{ aspects: ['preferButton', 'invalidHref'] }],
      errors: [{ messageId: 'preferButtonErrorMessage' }],
    },
    {
      code: 'html`<a @click=${foo}></a>`',
      options: [{ aspects: ['noHref', 'preferButton'] }],
      errors: [{ messageId: 'preferButtonErrorMessage' }],
    },
    {
      code: 'html`<a @click=${foo}></a>`',
      options: [{ aspects: ['noHref'] }],
      errors: [{ messageId: 'noHrefErrorMessage' }],
    },
    {
      code: 'html`<a @click=${foo}></a>`',
      options: [{ aspects: ['noHref', 'invalidHref'] }],
      errors: [{ messageId: 'noHrefErrorMessage' }],
    },
    {
      code: 'html`<a href="#" @click=${foo}></a>`',
      options: [{ aspects: ['preferButton'], allowHash: false }],
      errors: [{ messageId: 'preferButtonErrorMessage' }],
    },
    {
      code: 'html`<a href="#" @click=${foo}></a>`',
      options: [{ aspects: ['noHref', 'preferButton'], allowHash: false }],
      errors: [{ messageId: 'preferButtonErrorMessage' }],
    },
    {
      code: 'html`<a href="#" @click=${foo}></a>`',
      options: [{ aspects: ['preferButton', 'invalidHref'], allowHash: false }],
      errors: [{ messageId: 'preferButtonErrorMessage' }],
    },
    {
      code: 'html`<a href="#" @click=${foo}></a>`',
      options: [{ aspects: ['invalidHref'], allowHash: false }],
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
    },
    {
      code: 'html`<a href="#" @click=${foo}></a>`',
      options: [{ aspects: ['noHref', 'invalidHref'], allowHash: false }],
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
    },
    {
      code: 'html`<a href="javascript:void(0)" @click=${foo}></a>`',
      options: [{ aspects: ['preferButton'] }],
      errors: [{ messageId: 'preferButtonErrorMessage' }],
    },
    {
      code: 'html`<a href="javascript:void(0)" @click=${foo}></a>`',
      options: [{ aspects: ['noHref', 'preferButton'] }],
      errors: [{ messageId: 'preferButtonErrorMessage' }],
    },
    {
      code: 'html`<a href="javascript:void(0)" @click=${foo}></a>`',
      options: [{ aspects: ['preferButton', 'invalidHref'] }],
      errors: [{ messageId: 'preferButtonErrorMessage' }],
    },
    {
      code: 'html`<a href="javascript:void(0)" @click=${foo}></a>`',
      options: [{ aspects: ['invalidHref'] }],
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
    },
    {
      code: 'html`<a href="javascript:void(0)" @click=${foo}></a>`',
      options: [{ aspects: ['noHref', 'invalidHref'] }],
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
    },
    /// HREF PROPERTY
    {
      code: 'html`<a .href=${""}></a>;`',
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
    },
    {
      code: 'html`<a .href=${"#"}></a>`',
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
      options: [{ allowHash: false }],
    },
    {
      code: 'html`<a .href=${"javascript:void(0)"}></a>`',
      errors: [{ messageId: 'invalidHrefErrorMessage' }],
    },
    {
      code: 'html`<a .href=${"#"} @click=${foo}></a>`',
      options: [{ aspects: ['preferButton'], allowHash: false }],
      errors: [{ messageId: 'preferButtonErrorMessage' }],
    },
    {
      code: 'html`<a .href=${"javascript:void(0)"} @click=${foo}></a>`',
      options: [{ aspects: ['preferButton'] }],
      errors: [{ messageId: 'preferButtonErrorMessage' }],
    },
  ],
});

// The vendored surface hosts migrate against: same messageIds, same options.
void describe('anchor-is-valid meta', () => {
  void it("carries lit-a11y's three messageIds, unrenamed", () => {
    assert.deepEqual(Object.keys(anchorIsValid.meta?.messages ?? {}).sort(), [
      'invalidHrefErrorMessage',
      'noHrefErrorMessage',
      'preferButtonErrorMessage',
    ]);
  });

  void it('carries the base schema — aspects, allowHash — plus our allowElementParts and linkElements', () => {
    assert.deepEqual(anchorIsValid.meta?.schema, [
      {
        type: 'object',
        properties: {
          aspects: {
            description: 'Which anchor checks are active.',
            type: 'array',
            items: {
              type: 'string',
              enum: ['noHref', 'invalidHref', 'preferButton'],
            },
            uniqueItems: true,
            additionalItems: false,
            minItems: 1,
          },
          allowHash: {
            description: 'Whether a bare `#` counts as a valid href.',
            type: 'boolean',
          },
          allowElementParts: {
            description:
              'Whether a uiSref element part counts as the href it assigns at runtime (default `true`), replacing `settings.allowElementParts` for this rule.',
            type: 'boolean',
          },
          linkElements: {
            description:
              'Element tags to treat as link elements, replacing `settings.linkElements` for this rule.',
            type: 'array',
            items: { type: 'string' },
            uniqueItems: true,
          },
        },
      },
    ]);
  });

  void it('defaults allowHash on, as upstream does, and leaves allowElementParts to the setting', () => {
    assert.deepEqual(anchorIsValid.meta?.defaultOptions, [{ allowHash: true }]);
  });

  void it('is fixable, for the uiSref-to-srefHref rewrite', () => {
    assert.equal(anchorIsValid.meta?.fixable, 'code');
  });

  // The docs url is attached where the rule registers, so it is not on the
  // module here; rule-url.spec.ts covers it.
  void it('is a suggestion rule', () => {
    assert.equal(anchorIsValid.meta?.type, 'suggestion');
  });
});
