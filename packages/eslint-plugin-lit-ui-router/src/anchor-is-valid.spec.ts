import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import { anchorIsValid } from './anchor-is-valid.ts';

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
      name: "options pass through the wrap: aspects without 'noHref' quiets a dead anchor",
      code: `${IMPORTS}html\`<a>Home</a>\`;`,
      options: [{ aspects: ['invalidHref'] }],
    },
    {
      name: 'namespace imports still count',
      code: `import * as lit from 'lit';\nimport * as lur from 'lit-ui-router';\nlit.html\`<a \${lur.uiSref('home')}>Home</a>\`;`,
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
      name: "options pass through the wrap: an explicit 'noHref' aspect still reports",
      code: `${IMPORTS}html\`<a>Home</a>\`;`,
      options: [{ aspects: ['noHref'] }],
      errors: [{ messageId: 'noHrefErrorMessage' }],
    },
    {
      name: "a foreign package's uiSref proves nothing about this anchor",
      code: `import { html } from 'lit';\nimport { uiSref } from 'other-router';\nhtml\`<a \${uiSref('home')}>Home</a>\`;`,
      errors: [{ messageId: 'noHrefErrorMessage' }],
    },
  ],
});
