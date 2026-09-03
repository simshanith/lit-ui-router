import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import { srefAssignHref } from './sref-assign-href.ts';

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

ruleTester.run('sref-assign-href', srefAssignHref, {
  valid: [
    {
      name: "<a> is what 'auto' writes to, so the default is right",
      code: `${IMPORTS}html\`<a \${uiSref('home')}>Home</a>\`;`,
    },
    {
      name: '<area> is a native link too',
      code: `${IMPORTS}html\`<area \${uiSref('home')}>\`;`,
    },
    {
      name: 'a custom element may forward href, so only its author can say',
      code: `${IMPORTS}html\`<sp-link \${uiSref('home')}>Home</sp-link>\`;`,
    },
    {
      name: "'auto' is the documented fix",
      code: `${IMPORTS}html\`<button \${uiSref('home', {}, { assignHref: 'auto' })}>Home</button>\`;`,
    },
    {
      name: 'false is the app-managed answer',
      code: `${IMPORTS}html\`<button \${uiSref('home', {}, { assignHref: false })}>Home</button>\`;`,
    },
    {
      name: 'a non-literal options argument is unknowable',
      code: `${IMPORTS}const opts = { assignHref: 'auto' };\nhtml\`<button \${uiSref('home', {}, opts)}>Home</button>\`;`,
    },
    {
      name: 'a non-literal assignHref value is unknowable',
      code: `${IMPORTS}html\`<button \${uiSref('home', {}, { assignHref: choice })}>Home</button>\`;`,
    },
    {
      name: 'a spread options argument is unknowable',
      code: `${IMPORTS}html\`<button \${uiSref('home', {}, { ...opts })}>Home</button>\`;`,
    },
    {
      name: 'an attribute-position call is directive-position’s business',
      code: `${IMPORTS}html\`<button href=\${uiSref('home')}>Home</button>\`;`,
    },
    {
      name: "a foreign package's uiSref is not ours",
      code: `import { html } from 'lit';\nimport { uiSref } from 'other-router';\nhtml\`<button \${uiSref('home')}>Home</button>\`;`,
    },
  ],
  invalid: [
    {
      name: 'a state-only call on a <button> gains the params filler too',
      code: `${IMPORTS}html\`<button \${uiSref('home')}>Home</button>\`;`,
      errors: [{ messageId: 'hrefOnNonLink', data: { tag: 'button' } }],
      output: `${IMPORTS}html\`<button \${uiSref('home', {}, { assignHref: 'auto' })}>Home</button>\`;`,
    },
    {
      name: 'an existing params argument is left alone',
      code: `${IMPORTS}html\`<tr \${uiSref('home', { id: 1 })}>Home</tr>\`;`,
      errors: [{ messageId: 'hrefOnNonLink', data: { tag: 'tr' } }],
      output: `${IMPORTS}html\`<tr \${uiSref('home', { id: 1 }, { assignHref: 'auto' })}>Home</tr>\`;`,
    },
    {
      name: 'an empty options literal is replaced whole',
      code: `${IMPORTS}html\`<div \${uiSref('home', {}, {})}>Home</div>\`;`,
      errors: [{ messageId: 'hrefOnNonLink' }],
      output: `${IMPORTS}html\`<div \${uiSref('home', {}, { assignHref: 'auto' })}>Home</div>\`;`,
    },
    {
      name: 'an options literal with other keys gains the property',
      code: `${IMPORTS}html\`<button \${uiSref('home', {}, { relative: 'x' })}>Home</button>\`;`,
      errors: [{ messageId: 'hrefOnNonLink' }],
      output: `${IMPORTS}html\`<button \${uiSref('home', {}, { assignHref: 'auto', relative: 'x' })}>Home</button>\`;`,
    },
    {
      name: "assignHref: true on a non-link becomes 'auto'",
      code: `${IMPORTS}html\`<button \${uiSref('home', {}, { assignHref: true })}>Home</button>\`;`,
      errors: [{ messageId: 'hrefOnNonLink' }],
      output: `${IMPORTS}html\`<button \${uiSref('home', {}, { assignHref: 'auto' })}>Home</button>\`;`,
    },
    {
      name: 'an aliased uiSref import still counts',
      code: `import { html } from 'lit';\nimport { uiSref as sref } from 'lit-ui-router';\nhtml\`<button \${sref('home')}>Home</button>\`;`,
      errors: [{ messageId: 'hrefOnNonLink' }],
      output: `import { html } from 'lit';\nimport { uiSref as sref } from 'lit-ui-router';\nhtml\`<button \${sref('home', {}, { assignHref: 'auto' })}>Home</button>\`;`,
    },
    {
      name: 'a namespace import still counts',
      code: `import * as lit from 'lit';\nimport * as lur from 'lit-ui-router';\nlit.html\`<button \${lur.uiSref('home')}>Home</button>\`;`,
      errors: [{ messageId: 'hrefOnNonLink' }],
      output: `import * as lit from 'lit';\nimport * as lur from 'lit-ui-router';\nlit.html\`<button \${lur.uiSref('home', {}, { assignHref: 'auto' })}>Home</button>\`;`,
    },
  ],
});

void describe('sref-assign-href meta', () => {
  void it('is fixable and takes no options', () => {
    assert.equal(srefAssignHref.meta?.fixable, 'code');
    assert.deepEqual(srefAssignHref.meta?.schema, []);
  });

  void it("mirrors the runtime warning's wording", () => {
    assert.match(
      srefAssignHref.meta?.messages?.hrefOnNonLink ?? '',
      /which has no href in HTML.*'auto' becomes the default in 2\.0\./,
    );
  });
});
