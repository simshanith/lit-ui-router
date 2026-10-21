# @tools/release-ledger

The release ledger's model: what npm and GitHub say about each version, folded
region by region into one `versions` row. The design is
[#1430](https://github.com/simshanith/lit-ui-router/issues/1430); the D1
database that stores it is
[`www/release-ledger.lit-ui-router.dev`](../../www/release-ledger.lit-ui-router.dev/README.md).

- [`src/release-ledger.core.ts`](./src/release-ledger.core.ts) (`.`):
  `REGIONS`, the derived states and status, `fold`, `repair`, and the dist-tag
  moves. A row stores facts, never a state.
- [`src/release-ledger.fixtures.ts`](./src/release-ledger.fixtures.ts)
  (`./fixtures`): consistent rows and the observations that repeat them, for
  tests.

## Regions

Generated from `REGIONS`; `src/release-ledger.readme.test.ts` fails when this
copy differs.

| Region | Lifecycle                                                                      | Fixed facts                                                   | Mutable facts    | Conflict       | Cleared by   |
| ------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------- | ---------------- | -------------- | ------------ |
| tag    | —                                                                              | `git_sha`                                                     | —                | `tag_conflict` | `repair tag` |
| npm    | absent → active, absent → deprecated, active → deprecated, deprecated → active | `npm_integrity`, `npm_published_at`                           | `npm_deprecated` | `npm_conflict` | `repair npm` |
| gh     | none → final                                                                   | `gh_release_id`, `gh_url`, `gh_prerelease`, `gh_published_at` | `gh_body`        | `gh_conflict`  | `repair gh`  |

Each region moves only on its own source. An observation that contradicts a
recorded fixed fact, or reports it absent, stores itself in the region's
conflict column and leaves the fact as recorded; mutable facts keep following
the source. `repair` adopts the current observation for one region and clears
its conflict, and cannot erase recorded facts.
