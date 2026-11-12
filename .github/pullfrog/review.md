# Review instructions

Pullfrog's Review PRs automation follows this file. Read
[`AGENTS.md`](../../AGENTS.md) first; its conventions win over general best
practice.

## Scope

- Review semantics: correctness, lifecycle, public API and type surface, and
  whether a change does what its PR title says.
- CI already gates lint, format, types and tests (`mise run ci`). Do not
  report what oxlint, ESLint, stylelint, oxfmt, rumdl, actionlint, zizmor or
  shellcheck would catch.
- Skip lockfiles and `dist/`.
- Comment only. Do not approve, request changes, push or edit the PR.

## Tone

- Direct and technical. No praise, no restating the diff.
- Flag a concern once, with the input or state that makes it fail.
- Say so when you are unsure, and say nothing when there is nothing to flag.

## What to look for

The per-path guidance is `reviews.path_instructions` in
[`.coderabbit.yaml`](../../.coderabbit.yaml); apply it to the paths a PR
touches. The points that matter most:

- `packages/*/src`: anything reaching the emitted `.d.ts` must compile under
  TypeScript 5.0. `lit` and `@uirouter/core` are peer singletons. A new runtime
  dependency needs calling out.
- `packages/lit-ui-router/src`: every subscription or hook registered on
  connect is released on disconnect and registered again on reconnect.
- `.github/workflows`: a skipped required check reports as passing, so weigh
  whether a new condition can silently degrade a gate.
- `turbo.json`: task inputs over-approximate, and a task that writes files in
  place is uncacheable.
