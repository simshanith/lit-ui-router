# lit-ui-router/sref-active-class-aria-current

📝 Require an aria-current binding beside a srefActiveClass binding on a link element.

💼 This rule is enabled in the ✅ `recommended` config.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->

[`uiSrefActive`](https://lit-ui-router.dev/api/reference/directives/uiSrefActive) is an element part, and it writes `aria-current` itself: a link it marks active is active for CSS **and** for assistive technology. [`srefActiveClass`](https://lit-ui-router.dev/api/reference/directives/srefActiveClass) is the attribute-part sibling, and it only writes classes. A link styled active by it says nothing to a screen reader unless the author also binds `aria-current=${srefAriaCurrent(...)}` — a regression nobody sees, because the page still looks right.

This rule is the mirror of [`sref-active-aria-current`](./sref-active-aria-current.md): that one protects an authored `aria-current` from the element part's takeover, this one asks for the attribute the attribute part never writes.

## What is exempt

- **Any `aria-current`** — literal, bound, or bound to something else entirely. Whether its value is right is not this rule's business.
- **Non-link elements** — an `<li>`, a `<nav>`, a `<div>` with no `role`, an undeclared custom element. `srefActiveClass` on a wrapper is the container idiom, and `aria-current` on a wrapper is rarely what anyone meant; the links inside are each their own element, checked on their own terms.
- **A bound `role`** — unknowable statically, so it declares nothing.

A link element is `<a>`, `<area>`, an element whose literal `role` carries the `link` token, and whatever `settings.linkElements` (or this rule's own `linkElements` option) adds.

`srefActiveClass` in container mode — no `state`, matching whatever the enclosing `uiSref` names — still reports on a link, because a link painted active is a link owed the signal. `exactClasses` alone is the same case.

## Options

`linkElements` replaces `settings.linkElements` for this rule, wholesale; `[]` means "declare nothing here".

## Examples

Incorrect:

```js
import { html } from 'lit';
import { srefActiveClass, srefHref } from 'lit-ui-router';

html`<a href=${srefHref('home')} class=${srefActiveClass({ state: 'home' })}
  >Home</a
>`;
html`<div role="link" class="nav ${srefActiveClass({ state: 'home' })}">
  Home
</div>`;
```

Correct:

```js
import { html } from 'lit';
import { srefActiveClass, srefAriaCurrent, srefHref } from 'lit-ui-router';

html`<a
  href=${srefHref('home')}
  class=${srefActiveClass({ state: 'home' })}
  aria-current=${srefAriaCurrent({ state: 'home' })}
  >Home</a
>`;
// or let the element part own both
html`<li class=${srefActiveClass({})}><a href="/home">Home</a></li>`;
```

## Fix

The fix binds `aria-current` after the `class` attribute, copying the `state`, `params` and `options` the class binding was given — never the classes, which are the class binding's own — and adds `srefAriaCurrent` to the `lit-ui-router` import when it is not already there:

```diff
-import { srefActiveClass, srefHref } from 'lit-ui-router';
+import { srefActiveClass, srefAriaCurrent, srefHref } from 'lit-ui-router';

-html`<a href=${srefHref('home')} class=${srefActiveClass({ state: 'home' })}>Home</a>`;
+html`<a href=${srefHref('home')} class=${srefActiveClass({ state: 'home' })} aria-current=${srefAriaCurrent({ state: 'home' })}>Home</a>`;
```

A params argument that is not an object literal, one carrying a spread, and a call with no argument at all have nothing to copy, so they report without a fix.

If the element was never meant to be a link, drop its `role` — or move the class binding to the wrapper, which is the container idiom this rule leaves alone.
