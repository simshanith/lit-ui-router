# Third-party notices

This repository is MIT licensed (see [LICENSE](./LICENSE)). It also carries
material from the projects below, each under its own terms. Published packages
that vendor third-party code repeat the relevant notice in their own `LICENSE`
so it ships in the tarball.

## Vendored code

### eslint-plugin-lit-a11y (open-wc)

`packages/eslint-plugin-lit-ui-router/src/anchor-is-valid.ts` is vendored from
[eslint-plugin-lit-a11y](https://github.com/open-wc/open-wc/tree/master/packages/eslint-plugin-lit-a11y)
5.1.1, Copyright (c) 2018 open-wc. The open-wc repository is MIT while the
package manifest declares ISC; both are permissive. Full text in
[`packages/eslint-plugin-lit-ui-router/LICENSE`](./packages/eslint-plugin-lit-ui-router/LICENSE).

### @open-wc/semantic-dom-diff

`tools/lit-test-env/src/dom.ts` adapts `getDiffableHTML` from
[@open-wc/semantic-dom-diff](https://github.com/open-wc/open-wc/tree/master/packages/semantic-dom-diff)
0.21.0, MIT, Copyright (c) 2018 open-wc. The package is private and never
published; the open-wc MIT text is the one reproduced in
[`packages/eslint-plugin-lit-ui-router/LICENSE`](./packages/eslint-plugin-lit-ui-router/LICENSE).

### @uirouter/core

`packages/ui-router-server/src/url-matcher.ts` derives its `UrlMatcher`,
`Param`, and `ParamTypes` logic from
[@uirouter/core](https://github.com/ui-router/core), MIT, Copyright (c)
2013-2015 The AngularUI Team, Karsten Sperling. Full text in
[`packages/ui-router-server/LICENSE`](./packages/ui-router-server/LICENSE).

### libnpmdiff (npm)

`www/release-diffs.lit-ui-router.dev/src/format-diff.ts` ports
`lib/format-diff.js`, `lib/should-print-patch.js` and the file keys of
`lib/untar.js` from
[libnpmdiff](https://github.com/npm/cli/tree/latest/workspaces/libnpmdiff)
8.1.12, ISC, Copyright (c) GitHub Inc. The release-diffs worker runs it; the
ISC text:

> Permission to use, copy, modify, and/or distribute this software for any
> purpose with or without fee is hereby granted, provided that the above
> copyright notice and this permission notice appear in all copies.
>
> THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
> WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
> MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
> SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER
> RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF
> CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
> CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

## Derived work

### ui-router sample apps

The sample apps under `apps/` port the feature set, fixtures, and structure of
the upstream
[sample-app-react](https://github.com/ui-router/sample-app-react),
[sample-app-angular](https://github.com/ui-router/sample-app-angular), and
[sample-app-angularjs](https://github.com/ui-router/sample-app-angularjs),
MIT, by the UI-Router contributors (the upstream repositories publish no
copyright line).

## pnpm patches

The files under [`patches/`](./patches/) are small diffs applied to installed
dependencies at install time; each is a modification of the named package and
is offered under that package's license.

| Patch                                 | Package                            | License |
| ------------------------------------- | ---------------------------------- | ------- |
| `patches/@api-viewer__docs.patch`     | `@api-viewer/docs` (open-wc)       | MIT     |
| `patches/@api-viewer__tabs.patch`     | `@api-viewer/tabs` (open-wc)       | MIT     |
| `patches/@uirouter__visualizer.patch` | `@uirouter/visualizer` (UI-Router) | MIT     |
| `patches/lit-dialog.patch`            | `lit-dialog` (magethle)            | ISC     |

## Brand marks

The logos under `docs/public/images/brands/` (Angular, Cloudflare, Netlify,
Next.js, nginx, React Router, Svelte, Vue) are trademarks of their respective
owners, used nominatively to identify the project each one names. They are not
covered by this repository's MIT license.
