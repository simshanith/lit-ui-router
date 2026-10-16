# packages/shared

Private `@repo/*` source that two or more published packages import. Each
package here ships inside its consumers' tarballs, never as a dependency of
its own.

## What belongs here

Stateless code: every consumer inlines its own copy, so module state would
split between them. `check:shared-source`
([`tools/repo-checks/shared-source.core.ts`](../../tools/repo-checks/shared-source.core.ts))
rejects any top-level statement that could hold state or run a side effect.
Module-local ambient `declare` bindings pass, since they emit nothing; that
is how a module types a global such as `process` without `@types/node`.

## How it ships

`@tools/oxc-emit` compiles each file a shared package's `exports` names into
every consumer's `dist/shared/` (and `dist/development/shared/`) and points
the consumer's imports at it ([`tools/oxc-emit/src/inline.ts`](../../tools/oxc-emit/src/inline.ts)).
Nothing resolves `@repo/*` at runtime, and `.npmrc` blocks the scope from
public npm.

## Adding and consuming one

- Model a new package on an existing one: each `exports` subpath names one
  `.ts` file. Register it in the `workspace` catalog of `pnpm-workspace.yaml`.
- Give it a codecov component in `.github/codecov.yml` and add its coverage
  files to the Codecov upload step of `.github/workflows/build-test-run.yml`.
- A consumer lists it in `devDependencies` as `catalog:workspace`, which is
  where oxc-emit looks, and imports it by name.

The inlined copy lands at a path oxc-emit owns, while a `package.json`
`exports` or `imports` target names the consumer's own emit. A module that
must be its own target, such as a `#dev-gate` half, therefore gets a one-line
re-export in the consumer's `src/`:
[`packages/lit-ui-router-ssr/src/dev-gate.node.ts`](../lit-ui-router-ssr/src/dev-gate.node.ts).
