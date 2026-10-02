# lit-ui-router/sref-status-aria-current

📝 Require an aria-current binding on a link element whose classes read a SrefStatusController.

💼 This rule is enabled in the ✅ `recommended` config.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->

[`SrefStatusController`](https://lit-ui-router.dev/api/reference/controllers/SrefStatusController) is the third way a link learns it is active, and the only one that hands the status to the host rather than to the template. Its getters — `active`, `exact`, `entering`, `exiting`, `status` — exist so a component can compose them itself, usually with lit's `classMap`:

```js
class=${classMap({ 'nav-link': true, active: this.users.active })}
```

Nothing in that writes `aria-current`. The link is painted active for CSS and stays silent to assistive technology, which is the same regression [`sref-active-class-aria-current`](./sref-active-class-aria-current.md) catches for the attribute-part directive — except no directive call appears in the template, so that rule never fires. This one watches the controller instead.

The three together cover the whole surface: [`sref-active-aria-current`](./sref-active-aria-current.md) the **element part**, [`sref-active-class-aria-current`](./sref-active-class-aria-current.md) the **attribute part**, and this rule the **controller**.

## What counts as reading the controller

A controller instance is found two ways, both resolved through scope, so a shadowing local is never mistaken for the import:

- **A field on the enclosing class** — `users = new SrefStatusController(this, ...)`, a private `#users`, or `this.users = new SrefStatusController(...)` in the constructor's own body. `this` belongs to the class the template is written in, so a nested class sees its own fields and not the outer ones.
- **A local binding** — `const users = new SrefStatusController(host, ...)`, which is how a function-style host holds one.

Any read of that instance inside a bound `class` value counts: `.active`, `.exact`, `.status`, the instance passed to a helper, either arm of a ternary. The classes are derived from status either way, and this rule does not try to decide which reads paint and which do not.

Both spellings of the binding are the same binding: the `class` attribute, and the `.className` property form.

## What is exempt

- **Any `aria-current`** — literal, bound, or bound to something else entirely. Whether its value is right is not this rule's business.
- **Non-link elements** — an `<li>`, a `<nav>`, a `<div>` with no `role`, an undeclared custom element. A wrapper painted from container-mode status is the container idiom; the links inside are each their own element.
- **A bound `role`** — unknowable statically, so it declares nothing.
- **Expressions that read no tracked controller** — a class computed from an unknown identifier is statically unknowable, and silence is the only honest answer.

A link element is `<a>`, `<area>`, an element whose literal `role` carries the `link` token, and whatever `settings.linkElements` (or this rule's own `linkElements` option) adds.

## Options

`linkElements` replaces `settings.linkElements` for this rule, wholesale; `[]` means "declare nothing here".

## Examples

Incorrect:

```js
import { html } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { SrefStatusController } from 'lit-ui-router';

class NavBar extends LitElement {
  users = new SrefStatusController(this, { state: 'users' });

  render() {
    return html`<a
      href="/users"
      class=${classMap({ 'nav-link': true, active: this.users.active })}
      >Users</a
    >`;
  }
}
```

Correct:

```js
class NavBar extends LitElement {
  users = new SrefStatusController(this, { state: 'users' });

  render() {
    return html`<a
      href="/users"
      class=${classMap({ 'nav-link': true, active: this.users.active })}
      aria-current=${this.users.ariaCurrent()}
      >Users</a
    >`;
  }
}
```

`ariaCurrent()` returns the `aria-current` token while the state is active and lit's `nothing` otherwise, so the attribute appears and disappears the way the element part's does. Pass a value — `ariaCurrent('step')` — for a token other than `page`.

## Fix

The fix binds `aria-current` immediately after the `class` value, calling `ariaCurrent()` on the controller it found. The insertion point comes from the **last** expression in that value, so a mixed value lands after the closing quote:

```diff
-html`<a href="/users" class="nav ${this.users.active ? 'on' : ''}">Users</a>`;
+html`<a href="/users" class="nav ${this.users.active ? 'on' : ''}" aria-current=${this.users.ariaCurrent()}>Users</a>`;
```

Every report is fixable: the controller is already in scope at the binding, so there is no import to add and nothing to guess.

If the element was never meant to be a link, drop its `role` — or move the class binding to the wrapper, which is the container idiom this rule leaves alone.
