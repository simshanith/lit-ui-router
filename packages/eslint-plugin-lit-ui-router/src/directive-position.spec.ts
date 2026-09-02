import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import { directivePosition } from './directive-position.ts';

// RuleTester schedules cases through whatever framework is wired on these
// statics; eslint's types don't declare them.
const hooks = RuleTester as unknown as Record<string, unknown>;
hooks.describe = describe;
hooks.it = it;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

const IMPORTS = `
import { html } from 'lit';
import { uiSref, uiSrefActive } from 'lit-ui-router';
`;

ruleTester.run('directive-position', directivePosition, {
  valid: [
    {
      name: 'the element part is the supported position',
      code: `${IMPORTS}html\`<a \${uiSref('home')}>Home</a>\`;`,
    },
    {
      name: 'both directives on one element',
      code: `${IMPORTS}html\`<a \${uiSref('home')} \${uiSrefActive({})}>Home</a>\`;`,
    },
    {
      name: 'a call outside any template says nothing about its position',
      code: `${IMPORTS}const part = uiSref('home');\nhtml\`<a \${part}>Home</a>\`;`,
    },
    {
      name: "a foreign package's uiSref is not ours",
      code: `import { html } from 'lit';\nimport { uiSref } from 'other-router';\nhtml\`<a href=\${uiSref('home')}>Home</a>\`;`,
    },
    {
      name: 'a non-lit tagged template is not a lit template',
      code: `${IMPORTS}css\`\${uiSref('home')}\`;`,
    },
  ],
  invalid: [
    {
      name: 'attribute value position',
      code: `${IMPORTS}html\`<a href=\${uiSref('home')}>Home</a>\`;`,
      errors: [{ messageId: 'elementPartOnly', data: { name: 'uiSref' } }],
    },
    {
      name: 'property position',
      code: `${IMPORTS}html\`<a .href=\${uiSref('home')}>Home</a>\`;`,
      errors: [{ messageId: 'elementPartOnly' }],
    },
    {
      name: 'event listener position',
      code: `${IMPORTS}html\`<a @click=\${uiSref('home')}>Home</a>\`;`,
      errors: [{ messageId: 'elementPartOnly' }],
    },
    {
      name: 'boolean attribute position',
      code: `${IMPORTS}html\`<a ?hidden=\${uiSref('home')}>Home</a>\`;`,
      errors: [{ messageId: 'elementPartOnly' }],
    },
    {
      name: 'child position',
      code: `${IMPORTS}html\`<nav>\${uiSrefActive({})}</nav>\`;`,
      errors: [
        { messageId: 'elementPartOnly', data: { name: 'uiSrefActive' } },
      ],
    },
    {
      name: 'interpolated inside a quoted attribute',
      code: `${IMPORTS}html\`<a class="link \${uiSref('home')}">Home</a>\`;`,
      errors: [{ messageId: 'elementPartOnly' }],
    },
    {
      name: 'one good part and one bad one report exactly once',
      code: `${IMPORTS}html\`<a \${uiSref('home')} title=\${uiSrefActive({})}>Home</a>\`;`,
      errors: [
        { messageId: 'elementPartOnly', data: { name: 'uiSrefActive' } },
      ],
    },
    {
      name: 'a namespace import still counts',
      code: `import * as lit from 'lit';\nimport * as lur from 'lit-ui-router';\nlit.html\`<a href=\${lur.uiSref('home')}>Home</a>\`;`,
      errors: [{ messageId: 'elementPartOnly' }],
    },
  ],
});

void describe('directive-position meta', () => {
  void it('carries no fix: the position, not the call, is wrong', () => {
    assert.equal(directivePosition.meta?.fixable, undefined);
    assert.deepEqual(directivePosition.meta?.schema, []);
  });

  void it("names the directive, mirroring the runtime's own throw", () => {
    assert.match(
      directivePosition.meta?.messages?.elementPartOnly ?? '',
      /`\{\{name\}\}` must be used as an element part/,
    );
  });
});
