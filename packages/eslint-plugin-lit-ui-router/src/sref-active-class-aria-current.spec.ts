import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import { srefActiveClassAriaCurrent } from './sref-active-class-aria-current.ts';

// RuleTester runs cases through these statics, which eslint's types omit.
const hooks = RuleTester as unknown as Record<string, unknown>;

hooks.describe = describe;

hooks.it = it;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

const IMPORTS = `
import { html } from 'lit';
import { srefActiveClass, srefAriaCurrent } from 'lit-ui-router';
`;

// The import the fix has to extend, rather than the one it can reuse.
const CLASS_ONLY = `
import { html } from 'lit';
import { srefActiveClass } from 'lit-ui-router';
`;

ruleTester.run('sref-active-class-aria-current', srefActiveClassAriaCurrent, {
  valid: [
    {
      name: 'both bindings, which is the pair the fix produces',
      code: `${IMPORTS}html\`<a href="/home" class=\${srefActiveClass({ state: 'home' })} aria-current=\${srefAriaCurrent({ state: 'home' })}>Home</a>\`;`,
    },
    {
      name: 'a literal aria-current is the author’s to keep',
      code: `${IMPORTS}html\`<a href="/home" class=\${srefActiveClass({ state: 'home' })} aria-current="page">Home</a>\`;`,
    },
    {
      name: 'an unrelated aria-current binding is still an aria-current',
      code: `${IMPORTS}html\`<a href="/home" class=\${srefActiveClass({ state: 'home' })} aria-current=\${current}>Home</a>\`;`,
    },
    {
      name: 'an <li> is not a link, so nothing is owed',
      code: `${IMPORTS}html\`<li class=\${srefActiveClass({ state: 'home' })}><a href="/home">Home</a></li>\`;`,
    },
    {
      name: 'a <nav> is not a link either',
      code: `${IMPORTS}html\`<nav class=\${srefActiveClass({ state: 'home' })}></nav>\`;`,
    },
    {
      name: 'an undeclared custom element is unknown, not a link',
      code: `${IMPORTS}html\`<my-tab class=\${srefActiveClass({ state: 'home' })}></my-tab>\`;`,
    },
    {
      name: 'container mode on a wrapper is per-element, so the links inside are their own business',
      code: `${IMPORTS}html\`<li class=\${srefActiveClass({})}><a href="/home">Home</a></li>\`;`,
    },
    {
      name: 'a role that is not link leaves the element a non-link',
      code: `${IMPORTS}html\`<div role="tab" class=\${srefActiveClass({ state: 'home' })}></div>\`;`,
    },
    {
      name: 'a bound role is unknowable, so it declares nothing',
      code: `${IMPORTS}html\`<div role=\${role} class=\${srefActiveClass({ state: 'home' })}></div>\`;`,
    },
    {
      name: 'a class binding that is not ours',
      code: `import { html } from 'lit';\nimport { classMap } from 'lit/directives/class-map.js';\nhtml\`<a href="/home" class=\${classMap({ on: true })}>Home</a>\`;`,
    },
    {
      name: "a foreign package's srefActiveClass is not ours",
      code: `import { html } from 'lit';\nimport { srefActiveClass } from 'other-router';\nhtml\`<a href="/home" class=\${srefActiveClass({ state: 'home' })}>Home</a>\`;`,
    },
  ],
  invalid: [
    {
      name: 'an anchor painted active and silent',
      code: `${IMPORTS}html\`<a href="/home" class=\${srefActiveClass({ state: 'home' })}>Home</a>\`;`,
      errors: [
        {
          messageId: 'missingAriaCurrent',
          data: { tag: 'a', params: "{ state: 'home' }" },
        },
      ],
      output: `${IMPORTS}html\`<a href="/home" class=\${srefActiveClass({ state: 'home' })} aria-current=\${srefAriaCurrent({ state: 'home' })}>Home</a>\`;`,
    },
    {
      name: 'an <area> is a link element too',
      code: `${IMPORTS}html\`<map><area href="/home" class=\${srefActiveClass({ state: 'home' })} /></map>\`;`,
      errors: [
        {
          messageId: 'missingAriaCurrent',
          data: { tag: 'area', params: "{ state: 'home' }" },
        },
      ],
      output: `${IMPORTS}html\`<map><area href="/home" class=\${srefActiveClass({ state: 'home' })} aria-current=\${srefAriaCurrent({ state: 'home' })} /></map>\`;`,
    },
    {
      name: 'role="link" makes a <div> a link',
      code: `${IMPORTS}html\`<div role="link" class=\${srefActiveClass({ state: 'home' })}>Home</div>\`;`,
      errors: [
        {
          messageId: 'missingAriaCurrent',
          data: { tag: 'div', params: "{ state: 'home' }" },
        },
      ],
      output: `${IMPORTS}html\`<div role="link" class=\${srefActiveClass({ state: 'home' })} aria-current=\${srefAriaCurrent({ state: 'home' })}>Home</div>\`;`,
    },
    {
      name: 'a role token list containing link counts',
      code: `${IMPORTS}html\`<div role="link button" class=\${srefActiveClass({ state: 'home' })}>Home</div>\`;`,
      errors: [
        {
          messageId: 'missingAriaCurrent',
          data: { tag: 'div', params: "{ state: 'home' }" },
        },
      ],
      output: `${IMPORTS}html\`<div role="link button" class=\${srefActiveClass({ state: 'home' })} aria-current=\${srefAriaCurrent({ state: 'home' })}>Home</div>\`;`,
    },
    {
      name: 'static classes around the binding, so the insert lands past the quote',
      code: `${IMPORTS}html\`<a href="/home" class="nav \${srefActiveClass({ state: 'home', activeClasses: ['on'] })}">Home</a>\`;`,
      errors: [{ messageId: 'missingAriaCurrent' }],
      output: `${IMPORTS}html\`<a href="/home" class="nav \${srefActiveClass({ state: 'home', activeClasses: ['on'] })}" aria-current=\${srefAriaCurrent({ state: 'home' })}>Home</a>\`;`,
    },
    {
      name: 'a second expression in the value moves the insert past the quote',
      code: `${IMPORTS}html\`<a href="/home" class="\${srefActiveClass({ state: 'home' })} \${theme}">Home</a>\`;`,
      errors: [{ messageId: 'missingAriaCurrent' }],
      output: `${IMPORTS}html\`<a href="/home" class="\${srefActiveClass({ state: 'home' })} \${theme}" aria-current=\${srefAriaCurrent({ state: 'home' })}>Home</a>\`;`,
    },
    {
      name: 'params and options ride along; the classes stay behind',
      code: `${IMPORTS}html\`<a href="/home" class=\${srefActiveClass({ state: 'home', params: { id: 1 }, options: { relative: true }, exactClasses: ['exact'] })}>Home</a>\`;`,
      errors: [{ messageId: 'missingAriaCurrent' }],
      output: `${IMPORTS}html\`<a href="/home" class=\${srefActiveClass({ state: 'home', params: { id: 1 }, options: { relative: true }, exactClasses: ['exact'] })} aria-current=\${srefAriaCurrent({ state: 'home', params: { id: 1 }, options: { relative: true } })}>Home</a>\`;`,
    },
    {
      name: 'exactClasses alone still reports, and copies nothing',
      code: `${IMPORTS}html\`<a href="/home" class=\${srefActiveClass({ exactClasses: ['exact'] })}>Home</a>\`;`,
      errors: [{ messageId: 'missingAriaCurrent' }],
      output: `${IMPORTS}html\`<a href="/home" class=\${srefActiveClass({ exactClasses: ['exact'] })} aria-current=\${srefAriaCurrent({})}>Home</a>\`;`,
    },
    {
      name: 'the fix adds srefAriaCurrent to the import that has srefActiveClass',
      code: `${CLASS_ONLY}html\`<a href="/home" class=\${srefActiveClass({ state: 'home' })}>Home</a>\`;`,
      errors: [{ messageId: 'missingAriaCurrent' }],
      output: `
import { html } from 'lit';
import { srefActiveClass, srefAriaCurrent } from 'lit-ui-router';
html\`<a href="/home" class=\${srefActiveClass({ state: 'home' })} aria-current=\${srefAriaCurrent({ state: 'home' })}>Home</a>\`;`,
    },
    {
      name: 'an aliased srefAriaCurrent import is reused under its own name',
      code: `import { html } from 'lit';\nimport { srefActiveClass, srefAriaCurrent as current } from 'lit-ui-router';\nhtml\`<a href="/home" class=\${srefActiveClass({ state: 'home' })}>Home</a>\`;`,
      errors: [{ messageId: 'missingAriaCurrent' }],
      output: `import { html } from 'lit';\nimport { srefActiveClass, srefAriaCurrent as current } from 'lit-ui-router';\nhtml\`<a href="/home" class=\${srefActiveClass({ state: 'home' })} aria-current=\${current({ state: 'home' })}>Home</a>\`;`,
    },
    {
      name: 'a namespace import stays in its namespace, adding no import',
      code: `import * as lit from 'lit';\nimport * as lur from 'lit-ui-router';\nlit.html\`<a href="/home" class=\${lur.srefActiveClass({ state: 'home' })}>Home</a>\`;`,
      errors: [{ messageId: 'missingAriaCurrent' }],
      output: `import * as lit from 'lit';\nimport * as lur from 'lit-ui-router';\nlit.html\`<a href="/home" class=\${lur.srefActiveClass({ state: 'home' })} aria-current=\${lur.srefAriaCurrent({ state: 'home' })}>Home</a>\`;`,
    },
    {
      name: 'a non-literal params argument is unknowable, so the report carries no fix',
      code: `${IMPORTS}const params = { state: 'home' };\nhtml\`<a href="/home" class=\${srefActiveClass(params)}>Home</a>\`;`,
      errors: [{ messageId: 'unknownAriaCurrent' }],
      output: null,
    },
    {
      name: 'a spread could carry anything, so it stays unfixed',
      code: `${IMPORTS}html\`<a href="/home" class=\${srefActiveClass({ ...params })}>Home</a>\`;`,
      errors: [{ messageId: 'unknownAriaCurrent' }],
      output: null,
    },
    {
      name: 'no argument at all has nothing to copy',
      code: `${IMPORTS}html\`<a href="/home" class=\${srefActiveClass()}>Home</a>\`;`,
      errors: [{ messageId: 'unknownAriaCurrent' }],
      output: null,
    },
    {
      name: 'a declared link element reports the way an <a> does',
      code: `${IMPORTS}html\`<sp-link href="/home" class=\${srefActiveClass({ state: 'home' })}>Home</sp-link>\`;`,
      options: [{ linkElements: ['sp-link'] }],
      errors: [
        {
          messageId: 'missingAriaCurrent',
          data: { tag: 'sp-link', params: "{ state: 'home' }" },
        },
      ],
      output: `${IMPORTS}html\`<sp-link href="/home" class=\${srefActiveClass({ state: 'home' })} aria-current=\${srefAriaCurrent({ state: 'home' })}>Home</sp-link>\`;`,
    },
  ],
});

// `allowElementParts: false`: a server render never runs uiSrefActive, so a
// link carrying it is held to the attribute-part bar, and reports unfixed.
const SERVED = [{ allowElementParts: false }];

const ACTIVE = `
import { html } from 'lit';
import { uiSref, uiSrefActive } from 'lit-ui-router';
`;

ruleTester.run(
  'sref-active-class-aria-current (allowElementParts: false)',
  srefActiveClassAriaCurrent,
  {
    valid: [
      {
        name: 'by default the element part writes aria-current itself',
        code: `${ACTIVE}html\`<a \${uiSref('home')} \${uiSrefActive({ activeClasses: ['on'] })}>Home</a>\`;`,
      },
      {
        name: 'allowElementParts: true is the default behaviour',
        code: `${ACTIVE}html\`<a \${uiSref('home')} \${uiSrefActive({ activeClasses: ['on'] })}>Home</a>\`;`,
        options: [{ allowElementParts: true }],
      },
      {
        name: 'any authored aria-current is still the author’s',
        code: `${ACTIVE}html\`<a href="/home" aria-current=\${current} \${uiSrefActive({})}>Home</a>\`;`,
        options: SERVED,
      },
      {
        name: 'a wrapper is not a link, so nothing is owed',
        code: `${ACTIVE}html\`<li \${uiSrefActive({ activeClasses: ['on'] })}><a \${uiSref('home')}>Home</a></li>\`;`,
        options: SERVED,
      },
      {
        name: 'a bound role still declares nothing',
        code: `${ACTIVE}html\`<div role=\${role} \${uiSrefActive({})}></div>\`;`,
        options: SERVED,
      },
      {
        name: 'the served form passes',
        code: `${IMPORTS}html\`<a href="/home" class=\${srefActiveClass({ state: 'home' })} aria-current=\${srefAriaCurrent({ state: 'home' })}>Home</a>\`;`,
        options: SERVED,
      },
      {
        name: "a foreign package's uiSrefActive is not ours",
        code: `import { html } from 'lit';\nimport { uiSrefActive } from 'other-router';\nhtml\`<a href="/home" \${uiSrefActive({})}>Home</a>\`;`,
        options: SERVED,
      },
    ],
    invalid: [
      {
        name: 'a uiSrefActive part on a link is served with no aria-current',
        code: `${ACTIVE}html\`<a href="/home" \${uiSrefActive({ activeClasses: ['on'] })}>Home</a>\`;`,
        options: SERVED,
        errors: [{ messageId: 'elementPartNotServed', data: { tag: 'a' } }],
        output: null,
      },
      {
        name: 'role="link" makes a <div> a link here too',
        code: `${ACTIVE}html\`<div role="link" \${uiSrefActive({})}>Home</div>\`;`,
        options: SERVED,
        errors: [{ messageId: 'elementPartNotServed', data: { tag: 'div' } }],
        output: null,
      },
      {
        name: 'a declared link element reports the way an <a> does',
        code: `${ACTIVE}html\`<sp-link \${uiSref('home')} \${uiSrefActive({})}>Home</sp-link>\`;`,
        options: [{ allowElementParts: false, linkElements: ['sp-link'] }],
        errors: [
          { messageId: 'elementPartNotServed', data: { tag: 'sp-link' } },
        ],
        output: null,
      },
      {
        name: 'a namespace import is still ours',
        code: `import * as lit from 'lit';\nimport * as lur from 'lit-ui-router';\nlit.html\`<a href="/home" \${lur.uiSrefActive({})}>Home</a>\`;`,
        options: SERVED,
        errors: [{ messageId: 'elementPartNotServed' }],
        output: null,
      },
    ],
  },
);

// `settings.allowElementParts`, which an `allowElementParts` option replaces.
const servedTester = new RuleTester({
  settings: { allowElementParts: false },
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

servedTester.run(
  'sref-active-class-aria-current (settings.allowElementParts: false)',
  srefActiveClassAriaCurrent,
  {
    valid: [
      {
        name: 'the option replaces the setting for this rule',
        code: `${ACTIVE}html\`<a href="/home" \${uiSrefActive({})}>Home</a>\`;`,
        options: [{ allowElementParts: true }],
      },
    ],
    invalid: [
      {
        name: 'the setting alone reports as the option does',
        code: `${ACTIVE}html\`<a href="/home" \${uiSrefActive({})}>Home</a>\`;`,
        errors: [{ messageId: 'elementPartNotServed', data: { tag: 'a' } }],
        output: null,
      },
      {
        name: 'the setting holds beside other options',
        code: `${ACTIVE}html\`<sp-link \${uiSrefActive({})}>Home</sp-link>\`;`,
        options: [{ linkElements: ['sp-link'] }],
        errors: [
          { messageId: 'elementPartNotServed', data: { tag: 'sp-link' } },
        ],
        output: null,
      },
    ],
  },
);

const clientTester = new RuleTester({
  settings: { allowElementParts: true },
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

clientTester.run(
  'sref-active-class-aria-current (settings.allowElementParts: true)',
  srefActiveClassAriaCurrent,
  {
    valid: [
      {
        name: 'the setting credits the element part',
        code: `${ACTIVE}html\`<a href="/home" \${uiSrefActive({})}>Home</a>\`;`,
      },
    ],
    invalid: [
      {
        name: 'the option replaces the setting for this rule',
        code: `${ACTIVE}html\`<a href="/home" \${uiSrefActive({})}>Home</a>\`;`,
        options: SERVED,
        errors: [{ messageId: 'elementPartNotServed' }],
        output: null,
      },
    ],
  },
);

void describe('sref-active-class-aria-current meta', () => {
  void it('is fixable and takes the shared linkElements option', () => {
    assert.equal(srefActiveClassAriaCurrent.meta?.fixable, 'code');
    assert.ok(
      (
        srefActiveClassAriaCurrent.meta?.schema as
          | { properties?: Record<string, unknown> }[]
          | undefined
      )?.[0]?.properties?.linkElements,
    );
  });

  void it('leaves allowElementParts out of defaultOptions, so the setting reaches it', () => {
    assert.deepEqual(srefActiveClassAriaCurrent.meta?.defaultOptions, [{}]);
  });

  void it('names the served form for an element part', () => {
    assert.match(
      srefActiveClassAriaCurrent.meta?.messages?.elementPartNotServed ?? '',
      /class=\$\{srefActiveClass\(\.\.\.\)\} and aria-current=\$\{srefAriaCurrent\(\.\.\.\)\}/,
    );
  });

  void it('names the directive the author is owed, with the call the fix writes', () => {
    assert.match(
      srefActiveClassAriaCurrent.meta?.messages?.missingAriaCurrent ?? '',
      /srefAriaCurrent\(\{\{params\}\}\)/,
    );
  });

  void it('falls back to naming the params when they are unknowable', () => {
    assert.match(
      srefActiveClassAriaCurrent.meta?.messages?.unknownAriaCurrent ?? '',
      /srefAriaCurrent\(\.\.\.\)} with the same state, params and options/,
    );
  });
});
