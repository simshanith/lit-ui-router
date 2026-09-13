import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import { srefStatusAriaCurrent } from './sref-status-aria-current.ts';

// RuleTester runs cases through these statics, which eslint's types omit.
const hooks = RuleTester as unknown as Record<string, unknown>;
hooks.describe = describe;
hooks.it = it;

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

ruleTester.run('sref-status-aria-current', srefStatusAriaCurrent, {
  valid: [
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
  ],
  invalid: [
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
    assert.ok(
      (
        srefStatusAriaCurrent.meta?.schema as
          | { properties?: Record<string, unknown> }[]
          | undefined
      )?.[0]?.properties?.linkElements,
    );
  });

  void it('names the method the author is owed', () => {
    assert.match(
      srefStatusAriaCurrent.meta?.messages?.missingAriaCurrent ?? '',
      /ariaCurrent\(\)/,
    );
  });
});
