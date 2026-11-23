import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import tsParser from '@tools/eslint-ts-parser';
import { RuleTester } from 'eslint';
import { assertFixedLink } from '../test/fixed-link.ts';
import { LINK_ELEMENTS_SCHEMA } from './directives.ts';
import { srefStatusAriaCurrent } from './sref-status-aria-current.ts';

// RuleTester runs cases through these statics, which eslint's types omit.
Object.assign(RuleTester, { describe, it });

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

const IMPORTS = `
import { html } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { SrefStatusController } from 'lit-ui-router';
`;

/** A host holding the controller as a field, with `body` for its render. */
const host = (body: string, field = 'users') =>
  `${IMPORTS}class Nav {\n  ${field} = new SrefStatusController(this, { state: 'users' });\n  render() {\n    return ${body};\n  }\n}\n`;

/** A host whose constructor runs `statements`, with an unfixed render reading `this.users`. */
const constructed = (statements: string) =>
  `${IMPORTS}class Nav {\n  constructor(host) {\n    ${statements}\n  }\n  render() {\n    return html\`<a href="/users" class=\${classMap({ active: this.users.active })}>Users</a>\`;\n  }\n}\n`;

// Line endings around the read, as `before` the attribute and `after` the read.
const lineEnding = (name: string, before: string, after: string) => ({
  name,
  code: host(
    `html\`<a${before}href="/users" class="\${this.users.active ? 'on' : ''}${after}nav">Users</a>\``,
  ),
  errors: [{ messageId: 'missingAriaCurrent' }],
  output: host(
    `html\`<a${before}href="/users" class="\${this.users.active ? 'on' : ''}${after}nav" aria-current=\${this.users.ariaCurrent()}>Users</a>\``,
  ),
});

// espree folds CRLF to LF in a template's raw text; typescript-eslint keeps it.
const CRLF = [
  lineEnding('a CRLF after the read still lands past the quote', ' ', '\r\n  '),
  lineEnding(
    'a CRLF before the attribute still lands past the quote',
    '\r\n  ',
    ' ',
  ),
  lineEnding(
    'a lone CR after the read still lands past the quote',
    ' ',
    '\r  ',
  ),
  lineEnding(
    'mixed line endings still land past the quote',
    '\r\n',
    '\r\n\n\r  ',
  ),
];

const USERS = `aria-current=\${this.users.ariaCurrent()}`;

const CLASSES = `class=\${classMap({ active: this.users.active })}`;

/** How each fixed output parses, attribute by attribute, keyed by output. */
const FIXED = new Map<string, Record<string, string>>();

/** Register `test`'s output to parse as `attributes`, the fixed link's whole set. */
const parsesAs = <T extends { output: string }>(
  test: T,
  attributes: Record<string, string>,
): T => {
  FIXED.set(test.output, attributes);

  return test;
};

const LINK = { href: '/users', class: '${}', 'aria-current': '${}' };

const TITLED = { ...LINK, title: 'x' };

/** A link whose only aria-current is `bool`, followed by `after`; the fix leaves `fixed` after it. */
const booleanBinding = (
  name: string,
  bool: string,
  after = '',
  fixed = '',
  attributes: Record<string, string> = LINK,
) =>
  parsesAs(
    {
      name,
      code: host(
        `html\`<a href="/users" ${CLASSES} ${bool}${after}>Users</a>\``,
      ),
      errors: [
        {
          messageId: 'booleanAriaCurrent',
          data: { tag: 'a', controller: 'this.users' },
        },
      ],
      output: host(
        `html\`<a href="/users" ${CLASSES} ${USERS}${fixed}>Users</a>\``,
      ),
    },
    attributes,
  );

// lit's `?` binding writes aria-current="", which ARIA never exposes.
const BOOLEAN = [
  booleanBinding(
    'a boolean binding is replaced',
    '?aria-current=${this.users.active}',
  ),
  booleanBinding(
    'a boolean binding of a string still writes an empty value',
    "?aria-current=${this.users.active ? 'page' : ''}",
  ),
  booleanBinding(
    'a quoted boolean binding is replaced quotes and all',
    '?aria-current="${this.users.active}"',
  ),
  booleanBinding(
    'an upper-case boolean binding is the same binding',
    '?ARIA-Current=${this.users.active}',
  ),
  booleanBinding(
    'a boolean binding of two expressions is replaced whole',
    '?aria-current="${this.users.active} ${this.users.exact}"',
  ),
  booleanBinding(
    'a boolean binding of adjacent expressions is replaced whole',
    '?aria-current="${this.users.active}${this.users.exact}"',
  ),
  booleanBinding(
    'a boolean binding with static text is replaced whole',
    '?aria-current="x${this.users.active}"',
  ),
  booleanBinding(
    'a `${` in a comment does not move the replaced range',
    '?aria-current=${/* ${ */ this.users.active}',
  ),
  booleanBinding(
    'a `}` in a comment does not move the replaced range',
    '?aria-current=${this.users.active /* } */}',
  ),
  booleanBinding(
    'an attribute right after a quoted boolean binding stays its own',
    '?aria-current="${this.users.active}"',
    'title="x"',
    ' title="x"',
    TITLED,
  ),
  booleanBinding(
    'an attribute right after a single-quoted boolean binding stays its own',
    "?aria-current='${this.users.active}'",
    'title="x"',
    ' title="x"',
    TITLED,
  ),
  booleanBinding(
    'a self-closing slash right after a quoted boolean binding stays out of the value',
    '?aria-current="${this.users.active}"',
    '/',
    ' /',
  ),
  parsesAs(
    {
      name: 'a boolean binding before the class, across lines, is replaced in place',
      code: host(
        `html\`<a\r\n  ?aria-current=\${this.users.active}\r\n  ${CLASSES}\r\n>Users</a>\``,
      ),
      errors: [{ messageId: 'booleanAriaCurrent' }],
      output: host(`html\`<a\r\n  ${USERS}\r\n  ${CLASSES}\r\n>Users</a>\``),
    },
    { 'aria-current': '${}', class: '${}' },
  ),
  parsesAs(
    {
      name: 'a line break inside the boolean binding is replaced with it',
      code: host(
        `html\`<a href="/users" ?aria-current=\r\n  "\${this.users.active}" ${CLASSES}>Users</a>\``,
      ),
      errors: [{ messageId: 'booleanAriaCurrent' }],
      output: host(`html\`<a href="/users" ${USERS} ${CLASSES}>Users</a>\``),
    },
    { href: '/users', 'aria-current': '${}', class: '${}' },
  ),
];

const QUOTED_CLASS = `class="\${this.users.active ? 'on' : ''}"`;

// The insert path lands after the class value; what follows keeps its own parse.
const INSERT = [
  parsesAs(
    {
      name: 'a self-closing slash right after the quoted class stays out of the value',
      code: host(`html\`<a href="/users" ${QUOTED_CLASS}/>Users</a>\``),
      errors: [{ messageId: 'missingAriaCurrent' }],
      output: host(
        `html\`<a href="/users" ${QUOTED_CLASS} ${USERS} />Users</a>\``,
      ),
    },
    LINK,
  ),
  parsesAs(
    {
      name: 'an attribute right after the quoted class stays its own',
      code: host(`html\`<a href="/users" ${QUOTED_CLASS}title="x">Users</a>\``),
      errors: [{ messageId: 'missingAriaCurrent' }],
      output: host(
        `html\`<a href="/users" ${QUOTED_CLASS} ${USERS} title="x">Users</a>\``,
      ),
    },
    TITLED,
  ),
  parsesAs(
    {
      name: 'a `}` in a comment does not move the insertion point',
      code: host(
        `html\`<a href="/users" class=\${classMap({ active: this.users.active }) /* } */}>Users</a>\``,
      ),
      errors: [{ messageId: 'missingAriaCurrent' }],
      output: host(
        `html\`<a href="/users" class=\${classMap({ active: this.users.active }) /* } */} ${USERS}>Users</a>\``,
      ),
    },
    LINK,
  ),
];

// The fixed output is itself clean, so a second --fix pass changes nothing.
const BOOLEAN_FIXED = [
  ...new Set([...BOOLEAN, ...INSERT].map(({ output }) => output)),
].map((code, index) => ({
  name: `a fixed boolean binding stays fixed (${index + 1})`,
  code,
}));

// A real binding is authored; the boolean beside it is the author's to sort out.
const BOOLEAN_BESIDE_REAL = {
  name: 'a boolean binding beside a real aria-current binding',
  code: host(
    `html\`<a href="/users" ${CLASSES} ?aria-current=\${this.users.active} ${USERS}>Users</a>\``,
  ),
};

const tsRuleTester = new RuleTester({
  languageOptions: { parser: tsParser, sourceType: 'module' },
});

tsRuleTester.run(
  'sref-status-aria-current (typescript-eslint)',
  srefStatusAriaCurrent,
  {
    valid: [...BOOLEAN_FIXED, BOOLEAN_BESIDE_REAL],
    invalid: [...CRLF, ...BOOLEAN, ...INSERT],
  },
);

ruleTester.run('sref-status-aria-current', srefStatusAriaCurrent, {
  valid: [
    // The first is the pair below.
    ...BOOLEAN_FIXED.slice(1),
    BOOLEAN_BESIDE_REAL,
    {
      name: 'the pair the fix produces',
      code: host(
        `html\`<a href="/users" class=\${classMap({ active: this.users.active })} aria-current=\${this.users.ariaCurrent()}>Users</a>\``,
      ),
    },
    {
      name: 'a literal aria-current is the author’s to keep',
      code: host(
        `html\`<a href="/users" class=\${classMap({ active: this.users.active })} aria-current="page">Users</a>\``,
      ),
    },
    {
      name: 'an unrelated aria-current binding is still an aria-current',
      code: host(
        `html\`<a href="/users" class=\${classMap({ active: this.users.active })} aria-current=\${current}>Users</a>\``,
      ),
    },
    {
      name: 'the property form of aria-current counts too',
      code: host(
        `html\`<a href="/users" class=\${classMap({ active: this.users.active })} .ariaCurrent=\${this.users.status}>Users</a>\``,
      ),
    },
    {
      name: 'a <div> with no role is not a link',
      code: host(
        `html\`<div class=\${classMap({ active: this.users.active })}>Users</div>\``,
      ),
    },
    {
      name: 'an <li> wrapper is the container idiom, not a link',
      code: host(
        `html\`<li class=\${classMap({ active: this.users.active })}><a href="/users">Users</a></li>\``,
      ),
    },
    {
      name: 'a bound role is unknowable, so it declares nothing',
      code: host(
        `html\`<div role=\${role} class=\${classMap({ active: this.users.active })}>Users</div>\``,
      ),
    },
    {
      name: 'an identifier that is not a controller reads as nothing',
      code: `${IMPORTS}const users = { active: true };\nhtml\`<a href="/users" class=\${classMap({ active: users.active })}>Users</a>\`;`,
    },
    {
      name: "a foreign package's SrefStatusController is not ours",
      code: `import { html } from 'lit';\nimport { classMap } from 'lit/directives/class-map.js';\nimport { SrefStatusController } from 'other-router';\nclass Nav {\n  users = new SrefStatusController(this, {});\n  render() {\n    return html\`<a href="/users" class=\${classMap({ active: this.users.active })}>Users</a>\`;\n  }\n}\n`,
    },
    {
      name: 'a shadowing local class wins over the import',
      code: `import { html } from 'lit';\nimport { classMap } from 'lit/directives/class-map.js';\nimport { SrefStatusController } from 'lit-ui-router';\n{\n  class SrefStatusController {}\n  class Nav {\n    users = new SrefStatusController(this, {});\n    render() {\n      return html\`<a href="/users" class=\${classMap({ active: this.users.active })}>Users</a>\`;\n    }\n  }\n}\n`,
    },
    {
      name: 'classes composed from something else entirely',
      code: host(
        `html\`<a href="/users" class=\${classMap({ active: this.open })}>Users</a>\``,
      ),
    },
    {
      name: 'a template outside any class has no this to read',
      code: `${IMPORTS}html\`<a href="/users" class=\${classMap({ active: this.users.active })}>Users</a>\`;`,
    },
    {
      name: 'the controller read in a non-class attribute is not a paint',
      code: host(
        `html\`<a href="/users" ?hidden=\${this.users.exiting}>Users</a>\``,
      ),
    },
    {
      name: 'a static field is the class’s, not the instance’s this',
      code: `${IMPORTS}class Nav {\n  static users = new SrefStatusController(this, {});\n  render() {\n    return html\`<a href="/users" class=\${classMap({ active: this.users.active })}>Users</a>\`;\n  }\n}\n`,
    },
    {
      name: 'a constructor assignment inside a branch is not held',
      code: constructed(
        `if (host) {\n      this.users = new SrefStatusController(host, { state: 'users' });\n    }`,
      ),
    },
    {
      name: 'a constructor assignment inside a callback is not held',
      code: constructed(
        `queueMicrotask(() => {\n      this.users = new SrefStatusController(host, { state: 'users' });\n    });`,
      ),
    },
    {
      name: 'a logical assignment in the constructor is not held',
      code: constructed(
        `this.users ??= new SrefStatusController(host, { state: 'users' });`,
      ),
    },
    {
      name: 'a computed key in the constructor is not held',
      code: constructed(
        `this['users'] = new SrefStatusController(host, { state: 'users' });`,
      ),
    },
  ],
  invalid: [
    ...BOOLEAN,
    ...INSERT,
    {
      name: 'a field read through classMap',
      code: host(
        `html\`<a href="/users" class=\${classMap({ active: this.users.active })}>Users</a>\``,
      ),
      errors: [
        {
          messageId: 'missingAriaCurrent',
          data: { tag: 'a', controller: 'this.users' },
        },
      ],
      output: host(
        `html\`<a href="/users" class=\${classMap({ active: this.users.active })} aria-current=\${this.users.ariaCurrent()}>Users</a>\``,
      ),
    },
    {
      name: 'a private field',
      code: host(
        `html\`<a href="/users" class=\${classMap({ active: this.#users.exact })}>Users</a>\``,
        '#users',
      ),
      errors: [
        {
          messageId: 'missingAriaCurrent',
          data: { tag: 'a', controller: 'this.#users' },
        },
      ],
      output: host(
        `html\`<a href="/users" class=\${classMap({ active: this.#users.exact })} aria-current=\${this.#users.ariaCurrent()}>Users</a>\``,
        '#users',
      ),
    },
    {
      name: 'a constructor-assigned field',
      code: `${IMPORTS}class Nav {\n  constructor(host) {\n    this.users = new SrefStatusController(host, { state: 'users' });\n  }\n  render() {\n    return html\`<a href="/users" class=\${classMap({ active: this.users.active })}>Users</a>\`;\n  }\n}\n`,
      errors: [
        {
          messageId: 'missingAriaCurrent',
          data: { tag: 'a', controller: 'this.users' },
        },
      ],
      output: `${IMPORTS}class Nav {\n  constructor(host) {\n    this.users = new SrefStatusController(host, { state: 'users' });\n  }\n  render() {\n    return html\`<a href="/users" class=\${classMap({ active: this.users.active })} aria-current=\${this.users.ariaCurrent()}>Users</a>\`;\n  }\n}\n`,
    },
    {
      name: 'a local variable in a function-style host',
      code: `${IMPORTS}const nav = (host) => {\n  const users = new SrefStatusController(host, { state: 'users' });\n  return html\`<a href="/users" class=\${classMap({ active: users.active })}>Users</a>\`;\n};\n`,
      errors: [
        {
          messageId: 'missingAriaCurrent',
          data: { tag: 'a', controller: 'users' },
        },
      ],
      output: `${IMPORTS}const nav = (host) => {\n  const users = new SrefStatusController(host, { state: 'users' });\n  return html\`<a href="/users" class=\${classMap({ active: users.active })} aria-current=\${users.ariaCurrent()}>Users</a>\`;\n};\n`,
    },
    {
      name: 'the .className property form is the same binding',
      code: host(
        `html\`<a href="/users" .className=\${this.users.active ? 'nav on' : 'nav'}>Users</a>\``,
      ),
      errors: [{ messageId: 'missingAriaCurrent' }],
      output: host(
        `html\`<a href="/users" .className=\${this.users.active ? 'nav on' : 'nav'} aria-current=\${this.users.ariaCurrent()}>Users</a>\``,
      ),
    },
    {
      name: 'a static prefix, so the insert lands past the quote',
      code: host(
        `html\`<a href="/users" class="nav \${this.users.active ? 'on' : ''}">Users</a>\``,
      ),
      errors: [{ messageId: 'missingAriaCurrent' }],
      output: host(
        `html\`<a href="/users" class="nav \${this.users.active ? 'on' : ''}" aria-current=\${this.users.ariaCurrent()}>Users</a>\``,
      ),
    },
    {
      name: 'a two-expression class value inserts after the last one',
      code: host(
        `html\`<a href="/users" class="\${this.users.active ? 'on' : ''} \${this.theme}">Users</a>\``,
      ),
      errors: [{ messageId: 'missingAriaCurrent' }],
      output: host(
        `html\`<a href="/users" class="\${this.users.active ? 'on' : ''} \${this.theme}" aria-current=\${this.users.ariaCurrent()}>Users</a>\``,
      ),
    },
    ...CRLF,
    {
      name: 'an entity in the static text after the read still lands past the quote',
      code: host(
        `html\`<a href="/users" class="\${this.users.active ? 'on' : ''} a&amp;b">Users</a>\``,
      ),
      errors: [{ messageId: 'missingAriaCurrent' }],
      output: host(
        `html\`<a href="/users" class="\${this.users.active ? 'on' : ''} a&amp;b" aria-current=\${this.users.ariaCurrent()}>Users</a>\``,
      ),
    },
    {
      name: 'the instance handed to a helper still derives the classes',
      code: host(
        `html\`<a href="/users" class=\${paint(this.users)}>Users</a>\``,
      ),
      errors: [
        {
          messageId: 'missingAriaCurrent',
          data: { tag: 'a', controller: 'this.users' },
        },
      ],
      output: host(
        `html\`<a href="/users" class=\${paint(this.users)} aria-current=\${this.users.ariaCurrent()}>Users</a>\``,
      ),
    },
    {
      name: 'a namespace import is the same controller',
      code: `import * as lit from 'lit';\nimport * as lur from 'lit-ui-router';\nclass Nav {\n  users = new lur.SrefStatusController(this, {});\n  render() {\n    return lit.html\`<a href="/users" class=\${this.users.status}>Users</a>\`;\n  }\n}\n`,
      errors: [
        {
          messageId: 'missingAriaCurrent',
          data: { tag: 'a', controller: 'this.users' },
        },
      ],
      output: `import * as lit from 'lit';\nimport * as lur from 'lit-ui-router';\nclass Nav {\n  users = new lur.SrefStatusController(this, {});\n  render() {\n    return lit.html\`<a href="/users" class=\${this.users.status} aria-current=\${this.users.ariaCurrent()}>Users</a>\`;\n  }\n}\n`,
    },
    {
      name: 'role="link" makes a <div> a link',
      code: host(
        `html\`<div role="link" class=\${classMap({ active: this.users.active })}>Users</div>\``,
      ),
      errors: [
        {
          messageId: 'missingAriaCurrent',
          data: { tag: 'div', controller: 'this.users' },
        },
      ],
      output: host(
        `html\`<div role="link" class=\${classMap({ active: this.users.active })} aria-current=\${this.users.ariaCurrent()}>Users</div>\``,
      ),
    },
    {
      name: 'a declared link element reports the way an <a> does',
      code: host(
        `html\`<sp-link href="/users" class=\${classMap({ active: this.users.active })}>Users</sp-link>\``,
      ),
      options: [{ linkElements: ['sp-link'] }],
      errors: [
        {
          messageId: 'missingAriaCurrent',
          data: { tag: 'sp-link', controller: 'this.users' },
        },
      ],
      output: host(
        `html\`<sp-link href="/users" class=\${classMap({ active: this.users.active })} aria-current=\${this.users.ariaCurrent()}>Users</sp-link>\``,
      ),
    },
    {
      name: 'a nested class scopes this to the class it is written in',
      code: `${IMPORTS}class Outer {\n  users = new SrefStatusController(this, { state: 'users' });\n  render() {\n    class Inner {\n      inner = new SrefStatusController(this, { state: 'inner' });\n      mine() {\n        return html\`<a href="/i" class=\${classMap({ on: this.inner.active })}>I</a>\`;\n      }\n      theirs() {\n        return html\`<a href="/u" class=\${classMap({ on: this.users.active })}>U</a>\`;\n      }\n    }\n    return html\`<a href="/u" class=\${classMap({ on: this.users.active })}>U</a>\`;\n  }\n}\n`,
      errors: [
        {
          messageId: 'missingAriaCurrent',
          data: { tag: 'a', controller: 'this.inner' },
        },
        {
          messageId: 'missingAriaCurrent',
          data: { tag: 'a', controller: 'this.users' },
        },
      ],
      output: `${IMPORTS}class Outer {\n  users = new SrefStatusController(this, { state: 'users' });\n  render() {\n    class Inner {\n      inner = new SrefStatusController(this, { state: 'inner' });\n      mine() {\n        return html\`<a href="/i" class=\${classMap({ on: this.inner.active })} aria-current=\${this.inner.ariaCurrent()}>I</a>\`;\n      }\n      theirs() {\n        return html\`<a href="/u" class=\${classMap({ on: this.users.active })}>U</a>\`;\n      }\n    }\n    return html\`<a href="/u" class=\${classMap({ on: this.users.active })} aria-current=\${this.users.ariaCurrent()}>U</a>\`;\n  }\n}\n`,
    },
  ],
});

void describe('sref-status-aria-current meta', () => {
  void it('is fixable and takes the shared linkElements option', () => {
    assert.equal(srefStatusAriaCurrent.meta?.fixable, 'code');
    const schema = srefStatusAriaCurrent.meta?.schema;
    assert.ok(Array.isArray(schema));
    assert.equal(schema[0]?.properties?.linkElements, LINK_ELEMENTS_SCHEMA);
  });

  void it('names the method the author is owed', () => {
    assert.match(
      srefStatusAriaCurrent.meta?.messages?.missingAriaCurrent ?? '',
      /ariaCurrent\(\)/,
    );
  });
});

void describe('sref-status-aria-current fixed output', () => {
  for (const [output, attributes] of FIXED) {
    void it(`parses as one link: ${JSON.stringify(attributes)}`, () => {
      assertFixedLink(output, attributes);
    });
  }
});
