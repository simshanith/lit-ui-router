# @www/release-ledger

The release ledger's D1 schema and the pure fold that records what npm and
GitHub say about each version. The design is
[#1430](https://github.com/simshanith/lit-ui-router/issues/1430).

- [`migrations/`](./migrations): the D1 schema. A `versions` row stores facts,
  never a state; the `version_states` view derives each region's state and an
  overall status.
- [`src/release-ledger.core.ts`](./src/release-ledger.core.ts): `REGIONS`,
  `fold`, `abandon`, `repair`, the dist-tag moves, and the statements the queue
  consumer runs in one D1 batch.

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
its conflict, and cannot erase recorded facts. `npm_dist_tag` is advisory: only
the publish-npm claim sends it, and the first value stays.
