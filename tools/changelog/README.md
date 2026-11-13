# @tools/changelog

Reads and writes `packages/<pkg>/CHANGELOG.md`, the accumulating release text
of each published package.

- [`src/changelog.ts`](./src/changelog.ts) (`.`): parse a file into its
  preamble and `##` sections, extract one version's body, merge sections
  newest first by semver, and render the file with its fixed preamble.
- [`src/normalise.ts`](./src/normalise.ts): the structural changes a GitHub
  release body takes on its way into a section. The words stay as published.
- [`src/backfill.ts`](./src/backfill.ts): adds the sections a file lacks from
  the release ledger's stored GitHub release bodies.

## File contract

```markdown
# Changelog

Prereleases and canaries are not listed here; see [all releases on GitHub](https://github.com/simshanith/lit-ui-router/releases?q=<pkg>%40&expanded=true).

## <version> (<YYYY-MM-DD>)

<body>
```

One section per stable GitHub release, newest first; a version published to npm
with no GitHub release, such as `lit-ui-router@0.0.1`, has none. The heading's first token is the
version; the date is the release's publish day in UTC. Everything before the
first `##` heading is the preamble, which every writer replaces with the fixed text.
oxfmt and rumdl skip these files (`.oxfmtrc.json`, `.config/rumdl.toml`), so a
body stays byte for byte what was published.

## Backfill

The backfill reads a saved ledger read: the JSON body of the ledger worker's
`GET /ledger`, or the output of a D1 query over its `versions` table, such as

```sh
cf d1 query <database-id> --sql "SELECT name, version, gh_body, gh_published_at, npm_published_at FROM versions" > ledger.json
```

with the `database_id` from
[`wrangler.jsonc`](../../www/release-ledger.lit-ui-router.dev/wrangler.jsonc). Then:

```sh
pnpm --filter @tools/changelog backfill --ledger "$PWD/ledger.json" --dry-run
```

It adds only the stable versions a file has no section for and never rewrites
an existing one, so a re-run is a no-op until the ledger gains a release. Drop
`--dry-run` to write. It reports each package's releases that have no stored
body, the leading-heading styles of the bodies it added, and how many sections
each transformation touched; `--json` or `--json-out <path>` emits the same as
JSON.
