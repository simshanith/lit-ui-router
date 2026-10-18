# @www/release-ledger

The release ledger's D1 schema and the pure state machine that folds release
observations into it. The design is
[#1430](https://github.com/simshanith/lit-ui-router/issues/1430).

- [`migrations/`](./migrations): the D1 schema. Its `CHECK`s hold each
  `versions` row's state to the facts it records.
- [`src/release-ledger.core.ts`](./src/release-ledger.core.ts): the transition
  table, `fold`, and the compare-and-set statements the queue consumer runs in
  one D1 batch.

## Transitions

Generated from `TRANSITIONS`; `src/release-ledger.diagram.test.ts` fails when
this copy differs. Same-state pairs are not drawn: a repeated fact is a no-op, a
changed mutable fact updates in place, and a contradicted immutable fact is
rejected.

```mermaid
stateDiagram-v2
  [*] --> tagged: tag_observed
  state published {
    state "active" as published_active
    state "deprecated" as published_deprecated
    [*] --> published_active
    published_active --> published_deprecated: deprecation_observed
    published_deprecated --> published_active: undeprecation_observed
  }
  state released {
    state "active" as released_active
    state "deprecated" as released_deprecated
    [*] --> released_active
    released_active --> released_deprecated: deprecation_observed
    released_deprecated --> released_active: undeprecation_observed
  }
  tagged --> published: npm_observed
  tagged --> drifted: gh_release_observed
  tagged --> drifted: mismatch_observed
  tagged --> abandoned: abandon
  published --> released: gh_release_observed
  published --> drifted: mismatch_observed
  released --> drifted: mismatch_observed
  drifted --> abandoned: abandon (no npm facts)
  drifted --> tagged: repair
  drifted --> published: repair
  drifted --> released: repair
  abandoned --> drifted: npm_observed
  abandoned --> tagged: repair
  abandoned --> published: repair
  abandoned --> released: repair
  note right of drifted: ignores tag_observed, npm_observed, gh_release_observed, deprecation_observed, undeprecation_observed, mismatch_observed
```
