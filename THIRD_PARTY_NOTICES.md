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

### @uirouter/core

`packages/ui-router-server/src/url-matcher.ts` derives its `UrlMatcher`,
`Param`, and `ParamTypes` logic from
[@uirouter/core](https://github.com/ui-router/core), MIT, Copyright (c)
2013-2015 The AngularUI Team, Karsten Sperling. Full text in
[`packages/ui-router-server/LICENSE`](./packages/ui-router-server/LICENSE).

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

| Patch                             | Package                      | License |
| --------------------------------- | ---------------------------- | ------- |
| `patches/@api-viewer__docs.patch` | `@api-viewer/docs` (open-wc) | MIT     |
| `patches/lit-dialog.patch`        | `lit-dialog` (magethle)      | ISC     |

## Brand marks

The logos under `docs/public/images/brands/` (Angular, Cloudflare, Netlify,
Next.js, nginx, React Router, Svelte, Vue) are trademarks of their respective
owners, used nominatively to identify the project each one names. They are not
covered by this repository's MIT license.
