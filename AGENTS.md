# Agent guide

This file is an index. The details live in [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md),
[docs/TURBO.md](docs/TURBO.md), [docs/REMOTE_CACHE.md](docs/REMOTE_CACHE.md),
[docs/RELEASE.md](docs/RELEASE.md), [www/DEPLOY.md](www/DEPLOY.md) and
[apps/sample-app-lit-e2e/README.md](apps/sample-app-lit-e2e/README.md).

## Setup and commands

- Bootstrap with `mise trust`, `mise install`, `mise run setup` ([CONTRIBUTING: Development](docs/CONTRIBUTING.md#development)). A fresh checkout or worktree needs `mise trust` first.
- `mise run ci` is the full local gate, the same invocation the PR lane runs (ask first; see below). A scoped `turbo run build typecheck lint test` misses `format:check`; add it.
- Run bare `turbo` (on `PATH` via mise), never `pnpm turbo` or `pnpm exec turbo`. Run it in the foreground; a backgrounded run can die without an error.
- If a failure lands in a package your diff doesn't touch, rerun that task with `--force` before believing it; an aborted examples `npm ci` leaves `node_modules` half-written.
- `dist/` is never emptied by a build. Clear stale emit before reading `dist/` as shipped output ([CONTRIBUTING: Running Tests](docs/CONTRIBUTING.md#running-tests)).

## Layout

- `packages/` holds the published packages. `tools/` holds private `@tools/*` packages, blocked from public npm by `.npmrc`.
- Tooling that can't ask a package manager takes the repo root from `tools/bootstrap/src/root.ts`, never `../..` arithmetic.
- A new docs example is one entry in `examples/embeds.ts`.
- `www/lit-ui-router.dev` is the production docs site, deployed by Cloudflare Workers Builds ([www/DEPLOY.md](www/DEPLOY.md)).
- CLI scripts under `tools/` use a flat `main` with early exits and a one-line `import.meta.main` guard; see `tools/workers-builds/cloudflare-build.ts`.
- A module goes in `@tools/shared` only when two or more packages import it; with one consumer it lives in that package.
- pnpm links a package's `bin` into its dependents only, never its own `.bin`. A package's own task execs the file directly (0755 plus shebang), as `tools/build_and_test/mise.toml` does.
- `.config/` holds config only for tools that search it natively (mise, rumdl, taplo). Others keep their conventional location.

## mise

- mise tasks run node-free standalone jobs; turbo `//#` tasks are the cached fan-out. Keep the split.
- package.json scripts delegate with `mise run`, never `mise exec`.
- A nested `mise run` is a fresh process and re-runs the inner task's `depends`. Don't satisfy one edge from both sides.
- Name the tools when running `mise lock <tool>`; an unscoped run rewrites unrelated lock entries.
- Per-checkout overrides (such as `WWW_DEV_PORT`) go in a gitignored `.config/mise/config.local.toml`.

## Turbo

- Read [docs/TURBO.md](docs/TURBO.md) before editing `turbo.json`. turbo ships version-matched docs in `node_modules/turbo/docs/`: `README.md` maps tasks to pages, `reference/configuration.mdx` covers `turbo.json` fields. Check them before relying on a flag.
- `^task` reaches direct dependencies only; a task that must order across the whole graph self-chains (see `build:types`).
- `with:` is a co-scheduling hint, not an edge: it is unordered and gives the sidecar no dependents.
- A task that rewrites its own inputs (`format`) or measures the host (browser, fonts) is `cache: false`.
- `env` hashes the ambient environment; a variable set inline in the package.json script hashes as unset.
- Never add a workspace dependency just to give `^task` an edge. Use a `<pkg>#task` edge; `check:graph-edges` guards these. `check:knip` catches declared-but-unused deps.
- Inputs over-approximate with `$TURBO_DEFAULT$`; `check:task-inputs` fails a cacheable task whose key drops a tracked file.
- Scripts that exec turbo pin `cwd` to the workspace root; turbo narrows a run to the package it's invoked from.
- When a run fails, the stream prints `ELIFECYCLE` for cancelled tasks too. `--summarize` JSON names the real failure.
- `TURBO_FORCE` and remote cache modes: [docs/REMOTE_CACHE.md](docs/REMOTE_CACHE.md).

## pnpm and dependencies

- The mise pnpm pin must equal `packageManager`; `tools/repo-checks/pnpm-pin.test.ts` holds them together.
- Add workspace packages to `catalogs.workspace` in `pnpm-workspace.yaml` and depend on them as `catalog:workspace`.
- Bump by editing the catalog entry, then `mise run setup`. Don't run `pnpm update` for routine bumps; it rewrites catalog ranges.
- Keep `pnpm-workspace.yaml` bare: no comments, no YAML anchors. Rationale goes in the commit or PR.
- Overrides name their parent (`parent>child`), never a blanket range. Exact override pins can turn from floors into vulnerable ceilings; test one by deleting it.
- Peer floors live in the `peerFloor*` and `publishedPeer*` catalogs. A released package's peer ranges admit no prerelease line.
- Dependabot edits to reject: narrowing the `@oxc-project/runtime` floor in `publishedDependencies`, `rolldown` without `vite`, and `oxlint` without `eslint-plugin-oxlint`.
- Accepted audit advisories go under `audit:` ([CONTRIBUTING: Dependency audit](docs/CONTRIBUTING.md#dependency-audit)).

## Lint and format

- oxlint config is `.oxlintrc.json`. `!` negations in an override's `files` are ignored (use `excludeFiles`), a later override replaces a rule's config instead of merging, and `no-restricted-imports` `regex` has no lookaround. Misconfiguration is silent, so prove a new override fires with a temporary violation.
- `.js`/`.mjs`/`.cjs` files have type-aware rules off; renaming one to `.ts` turns them on. `lint:root` ignores `tools/`, so run `turbo run lint`.
- oxlint doesn't count `{@link X}` as a use. Link without a doc-only import: `{@link "@uirouter/core"!StateService | StateService}`.
- lit-analyzer runs through `tools/lit-template-lint` (`//#lint:templates`). Its only suppression is `@ts-ignore` in a template HTML comment. It rejects `@focusout` (bind it imperatively) and `color-scheme` inside `css` blocks (declare it at `:root`).
- oxfmt formats `.md`, YAML and `package.json` too, and owns top-level key order. rumdl lints Markdown (`mise run lint_markdown`); taplo owns TOML.
- Suppressions are fine when justified; prefer clean code when possible.

## Testing and e2e

- The PR lane runs chrome only. Specs in `browserOnlySpecs` (vitest config) first meet Firefox and WebKit on `main`.
- happy-dom doesn't retarget composed events and calls `dispatchEvent` once per phase; count events with `addEventListener`, not a spy.
- Re-render specs build templates from one factory; two `html` literals are two templates and rebuild the element.
- e2e serves on port 8787 by default, shared across checkouts; see the e2e README to move one. `wrangler dev` crashes are a known flake; rerun first.
- Test effort goes to `packages/*` before the docs site.
- Codecov failures: [CONTRIBUTING: Reproducing a Codecov failure](docs/CONTRIBUTING.md#reproducing-a-codecov-failure).

## lit runtime traps

- `AsyncDirective.reconnected()` runs while a `cache()`'d fragment is still detached. Defer DOM traversal to a task.
- A property set before upgrade replays in the first update, not at `connectedCallback`.
- Core stays minimal; SSR and hydration costs live in `lit-ui-router-ssr`.
- Opinionated runtime integrations (cache, data layers) prove out in a sample app first, then a companion package; never in `lit-ui-router`.

## TypeScript and build

- Published `.d.ts` must stay valid under TypeScript 5.0 ([CONTRIBUTING: TypeScript authoring](docs/CONTRIBUTING.md#typescript-authoring)).
- `@tools/oxc-emit` owns the JS and declaration passes. Declaration emit is syntactic: derive exported types from `as const` data, never from objects of imported values.
- TypeScript 7 has no JS API. Members that import the compiler (typedoc, vite-plugin-checker, cypress) use the `typescript6-compat` catalog.
- TypeScript 6+ defaults `types` to `[]`; list ambient types explicitly in new tsconfigs.
- Settle an entry's public exports before its first publish; prefer named re-exports over `export *`.

## PRs, commits, releases

- Squash-only: the PR title is the commit subject, so one PR is one changelog entry. Split changes of different types ([CONTRIBUTING: Commit conventions](docs/CONTRIBUTING.md#commit-conventions)).
- After a stack's base squash-merges, check siblings for silent reverts before merging.
- The `release` label belongs to bump-version PRs only.
- Releases: [docs/RELEASE.md](docs/RELEASE.md).

## Maintainer-owned actions

Agents never:

- merge PRs, or enable auto-merge;
- mark PRs ready for review;
- dispatch release workflows;
- make Cloudflare account or dashboard changes;
- push to `dependabot/*` branches; redo the bump on their own branch instead;
- edit or delete GitHub releases, or unpublish npm versions. Releases are immutable, and canary releases stay as evidence;
- create labels. Label PRs by subject from the existing set;
- force-push, except `--force-with-lease` on their own branch.

Ask before running `mise run ci`, `mise run ci_main`, or e2e (Cypress, the wrangler server). Headless browser specs that turbo test tasks run need no ask.

## Conventions

- Code comments: one line stating the constraint, or none. The story goes in the commit or PR.
- Docs describe the present state and point at config files and schemas rather than restating them.
- Match existing conventions and their vocabulary. Check `git log`/`git blame` before reversing a pattern.
- No `isRecord`-style shape guards: validate with valibot, or cast honestly and fail loudly.
- Reproduce a CI failure locally before speculating about it ([CONTRIBUTING: Reproducing a CI failure](docs/CONTRIBUTING.md#reproducing-a-ci-failure)).
- Upstream issues, PRs and comments written by an agent carry a footer naming the agent and model.
- Save long command output to a file, check the exit code, and search the file. Never re-run a command to `head` or `tail` it differently, and never truncate a state-changing command such as `git push`.
- Answer questions about repo state from a freshly fetched `origin/main`, not the working tree.
- Titles and commit subjects use a plain verb (restore, fix, re-enable), never a borrowed slogan.
- Prefer the ecosystem-standard action or tool over custom CI code. When custom code is unavoidable, name the standard alternative in the PR.
- Read manifests and registry data with node tooling (`npm pkg get`, a narrowed `npm view`) before reaching for another language.
- Judge a tool by its maintenance cost, not its language; a mise-installed binary is cheap.
- Open-PR triage looks for interactions git won't flag: one PR's new code referencing what another PR renames or removes.

## Skills

Skills live in `.agents/skills/<name>/SKILL.md`. Claude Code reads only `.claude/skills/`, so each skill also gets a relative symlink there (`.claude/skills/<name> -> ../../.agents/skills/<name>`).

A skill stays thin: when to use it and what an unattended run needs, linking the doc or package README that owns the recipe.

- `ci-failure-repro`: reproduce a red GitHub Actions run locally from its `repro:` line.
- `cypress-sample-app`: run a sample app on a vite dev server and drive it with one Cypress spec.
