import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import { anchorIsValid } from './anchor-is-valid.ts';

// RuleTester runs cases through these statics, which eslint's types omit.
const hooks = RuleTester as unknown as Record<string, unknown>;
hooks.describe = describe;
hooks.it = it;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

const IMPORTS = `
import { html } from 'lit';
import { uiSref } from 'lit-ui-router';
`;

ruleTester.run('anchor-is-valid', anchorIsValid, {
  valid: [
    {
      name: 'uiSref part assigns an href at runtime',
      code: `${IMPORTS}html\`<a \${uiSref('home')}>Home</a>\`;`,
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

  void it('carries the base schema — aspects, allowHash — plus our linkElements', () => {
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

  void it('defaults allowHash on, as upstream does', () => {
    assert.deepEqual(anchorIsValid.meta?.defaultOptions, [{ allowHash: true }]);
  });

  void it("is a suggestion rule pointing at this package's docs", () => {
    assert.equal(anchorIsValid.meta?.type, 'suggestion');
    assert.match(
      anchorIsValid.meta?.docs?.url ?? '',
      /simshanith\/lit-ui-router.*docs\/rules\/anchor-is-valid\.md$/,
    );
  });
});
