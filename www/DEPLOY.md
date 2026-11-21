# Deploy Guide

[![workers-builds trigger drift](https://img.shields.io/github/check-runs/simshanith/lit-ui-router/main?nameFilter=workers-builds%20%28triggers%29&label=workers-builds)](https://github.com/simshanith/lit-ui-router/actions/workflows/release-signals.yml?query=branch%3Amain)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Flit-ui-router.dev)](https://lit-ui-router.dev)

Live state of the pipeline this guide describes: whether the Cloudflare dashboard still matches the
repo config, and whether the site it deploys is up. See
[CD-pipeline verification signal](#cd-pipeline-verification-signal) for what each color means.

---

<p align="center">
<img src="https://raw.githubusercontent.com/cloudflare/workers-sdk/main/cloudflare-workers-outline.png" alt="workers-logo" width="120px" height="120px"/>
<br />
<a href="https://github.com/cloudflare/workers-sdk">Cloudflare Workers SDK</a>
<br />
</p>

---

## [Cloudflare Workers](https://developers.cloudflare.com/workers/) with [Static Assets](https://developers.cloudflare.com/workers/static-assets/)

The Cloudflare [GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/) deploys documentation on push.
It deploys every Worker app under `www/` the same way, except the [frozen 1.x docs](#frozen-1x-docs-at-v1), which are deployed by hand: each is a package in `www/<domain>`, named
`@www/<domain>`, with its own worker config and its own Workers Builds triggers, and the domain is
the site key that the build and deploy commands below take as their last argument. This section
describes the docs site, the default when that argument is omitted; [Adding a site](#adding-a-site)
covers the rest.

- Production `main` branch deploys to [lit-ui-router.dev](https://lit-ui-router.dev)
- Development branches deploy to [preview URLs](https://developers.cloudflare.com/workers/configuration/previews/) with the `-lit-ui-router.shane-cf1.workers.dev` domain suffix

### Configuration Files

All of them live in the site package, `www/lit-ui-router.dev/`:

| File              | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wrangler.jsonc`  | [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/) - defines worker name, entry point, assets directory, and routing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `worker/index.ts` | [Worker script](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) - runs first for the paths `run_worker_first` lists in `wrangler.jsonc`: it renders the release pages and their sitemap (`/releases/sitemap.xml`) and answers the `/gh` redirects from the tables in `worker/releases/routes.ts`, redirects `/main/` to the root, serves `ui-router-server` verdicts (shell, 302, or 404) for the sample-app and exhibit mounts in `sample-app-routes` (`apps/sample-app-routes/src/routes.ts`), and serves the shell unrouted under `/not-found-naive`; everything else serves static assets, misses fall back to `404.html` |
| `public/_headers` | [Headers](https://developers.cloudflare.com/pages/configuration/headers/) - sets COOP, COEP, the security headers of `catalog/security-headers.ts` (which the worker adds to its own responses, since `_headers` reaches only static assets) and a `Link` header advertising `/llms.txt`, and caches `/assets/` for a year, where Vite names every file by a hash of its content                                                                                                                                                                                                                                                                              |
| `catalog/`        | Site data the config, build and worker read: `navigation.ts` (sidebar and top nav), `packages.ts` (package roles), `redirects.ts` (moved docs URLs as [redirects](https://developers.cloudflare.com/workers/static-assets/redirects/); the build writes them to `dist/_redirects`, and the dev server answers them too) and `surfaces.ts` (each URL space's renderer, and whether the sitemap index (the build's `/sitemap.xml`, over `/sitemap-pages.xml` and each listed worker row's own), `llms.txt`, local search and the dead-link check include it; its test holds the worker rows to `run_worker_first`)                                              |

Package READMEs, manifests and shipped sources link the site, and a published tarball can't
change. `.vitepress/test/published-links.test.ts` resolves each such link against the page
sources, the generated API reference, the worker's routes and `redirects.ts`, headings
included. `catalog/published-urls.txt` lists every link a package ships, released or about
to be, as a path or `path#fragment`, and the test fails until a new link is listed there.
Every listed path and fragment must keep resolving, and a redirect rule that catches one
carries `linkedFrom` naming the packages behind it. A fragment must match a Markdown
heading id on the target page; raw `<a id>` anchors don't count. To rename a heading that
a listed fragment names, keep the old id with `## New heading {#old-id}`.

### Wrangler Setup

Wrangler is installed in both:

- Root `package.json` - for deployment commands
- `www/lit-ui-router.dev/package.json` - its scripts (`wrangler dev`, `wrangler types`, the dry-run bundle) run with the package as cwd, so wrangler finds the `wrangler.jsonc` beside them

The deploy runs from the repo root, where no config lives, so it names the site's file with
`--config www/<site>/wrangler.jsonc` — inside
[`cloudflare-deploy.ts`](../tools/workers-builds/cloudflare-deploy.ts), not in the dashboard
(see [Build & Deploy Commands](#build--deploy-commands)).

See: [Wrangler Commands](https://developers.cloudflare.com/workers/wrangler/commands/)

### cf Setup

The release diffs is configured by a `cloudflare.config.ts` instead, a project for the
[`cf` CLI](https://developers.cloudflare.com/cf/projects/) (beta). Its package declares both `cf`,
which `cloudflare.config.ts` imports from, and `wrangler`, the bundler `cf` delegates to; each must
be installed in the package itself. `cf` has no config flag and reads only the
`cloudflare.config.ts` in its working directory, so every `cf` command runs with the package as
cwd. `types:worker` runs `cf workers types`, which writes `.cloudflare/types/` (gitignored, like
the build output beside it).

### Build & Deploy Commands

| Environment                                                                                             | Build                                        | Deploy                                               |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------- |
| Production                                                                                              | `./tools/workers-builds/cloudflare-build.ts` | `./tools/workers-builds/cloudflare-deploy.ts main`   |
| Preview ([Versions](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/)) | `./tools/workers-builds/cloudflare-build.ts` | `./tools/workers-builds/cloudflare-deploy.ts branch` |

Every other site appends its key to both commands (`cloudflare-build.ts <site>`,
`cloudflare-deploy.ts main <site>`), as its entry in
[`workers-builds-triggers.config.jsonc`](../tools/workers-builds/workers-builds-triggers.config.jsonc)
records. The key resolves to `www/<site>/`, whose `package.json` must be named `@www/<site>`; an
unknown key, a mismatched name or an extra argument exits 2 before any step runs. The docs site's
commands stay bare because a trigger's command is shared by every branch it builds, including
branches whose checkout predates the argument.

Both commands are **repo scripts, not the steps themselves**
([`cloudflare-build.ts`](../tools/workers-builds/cloudflare-build.ts),
[`cloudflare-deploy.ts`](../tools/workers-builds/cloudflare-deploy.ts)). A trigger holds one
command for every branch it matches, so inlining the steps means a branch cannot
change them — and a package-manager change is exactly a branch that needs to. Pinning the
path instead lets the script differ per branch while the declared value stays constant, so
divergence never reads as drift and never needs an `--apply` to test.

[`cloudflare-build.ts`](../tools/workers-builds/cloudflare-build.ts) runs **before** the
install, so it cannot import a workspace package by name; its one non-builtin import is a relative
reach into [`@tools/bootstrap`](../tools/bootstrap), whose own lint rule holds it to node builtins
and its own files, so resolution never consults `node_modules`.

That resolve-without-`node_modules` constraint is lint-enforced, not just documented:
`.oxlintrc.json` scopes `no-restricted-imports` to `cloudflare-build.ts` and allows only node
builtins plus an explicit list of relative paths. Bare specifiers are refused because nothing
resolves them at that point, and same-package siblings are refused because the rule is
per-file and cannot see what a sibling imports — `workers-builds-triggers.core.ts` pulls
`valibot` and `jsonc-parser`. Adding a relative import means adding it to that list, and it
has to be a file whose own imports are node builtins all the way down — which for
`@tools/bootstrap` is its package's own structural guarantee rather than a case-by-case read.

The build image is Ubuntu with node and npm; the script installs pnpm, and `pnpm install`
provides everything after that. There is no mise, so none of the repo's mise-managed tools —
`taplo`, `shellcheck`, `rumdl`, `actionlint`, `zizmor` — exists during a deploy. The build's
turbo target is `@www/<site>#build`; `build` is defined at the root, so a site with no build
script of its own (wrangler bundles it at deploy) builds only its dependencies and succeeds.
Anything that target reaches has to run on workspace binaries alone. It does today: for the
docs site that closure is 151 tasks, 44 of which run a command, and every one of those is a
package `devDependency` or node itself. Nothing enforces this, because nothing needs to — a
violation turns the Workers Builds check red on the branch that introduces it, before any merge.

The script **derives the pnpm to bootstrap from `packageManager`** rather than restating it.
A second pin could drift from `packageManager` with nothing to catch it, and a build on a
stale pnpm can still deploy green. Deriving is also what makes the
per-branch divergence above free: a branch that changes the package manager gets the right
bootstrap with no edit to this file.

The deploy script takes the trigger as its first argument and the site as its optional second.
`branch` runs `npx wrangler versions upload`; `preview` runs `npx wrangler preview`, for a site
whose branches build as [Workers Previews](#workers-previews); `main` runs `npx wrangler deploy`, preceded by
`npx wrangler d1 migrations apply <database_name> --remote` for every `d1_databases` entry in the
site's `wrangler.jsonc` that sets `migrations_dir`. Each names the site's config with `--config`,
since the deploy runs from the repo root and the config lives in the site package. A site whose
package has a `cloudflare.config.ts` deploys with `cf` instead, from the package: `branch` runs
`npx cf workers versions create`, `preview` `npx cf previews deploy`, `main` `npx cf deploy`, and
nothing migrates, since `cloudflare.config.ts` declares no D1 migrations. A failed
migration stops the deploy, so production code never runs ahead of its schema. Only `main`
migrates: a version upload binds the same remote databases as production, and a Preview binds
only what its `previews` block names. wrangler skips its migration
confirmation prompt when `WORKERS_CI` is set (as it is in Workers Builds) or there is no TTY,
answering yes, so the step neither waits nor skips. A moved `wrangler.jsonc` changes this
script's internals and leaves the dashboard alone — no `--apply` owed, and no ordering against
the merge.

It is TypeScript rather than bash: by deploy time the install has run, so it is node's own
type stripping like every other tool script, and it exports its commands so the trigger
test checks each site's wrangler invocations by importing them instead of grepping the source. The
build script is TypeScript too, though it is the bootstrap and runs before the install: type
stripping needs nothing installed, and its imports are held to what resolves without
`node_modules`. `process.execve` replaces the process the way bash `exec` did, so wrangler's exit
code and signals are the script's; execve does not search `PATH`, so the script asks the
shell (`command -v npx`) for the path before handing over.

The build script owns the dependency install because Workers Builds provisions pnpm with
corepack, which cannot install a pnpm-12 `packageManager` pin at all — the npm package is
a wrapper whose real binary is materialized by a `preinstall` hook out of an optional
platform dependency, and corepack runs neither lifecycle scripts nor optional
dependencies. So `SKIP_DEPENDENCY_INSTALL=1` turns off Cloudflare's install step and the
script runs `npm install --global --allow-scripts=pnpm` with the exact `pnpm@<version>`
from `packageManager`, which lets the `preinstall` hook unpack the real binary. pnpm does
not swap versions itself (`pmOnFail: ignore`), so that install is the version that runs.

The global install replaces the corepack shim rather than sitting beside it: anything turbo
spawns resolves `pnpm` from `PATH`, so a pnpm reachable only through the commands the script
names would leave turbo on the unusable shim.

`build_command` and `SKIP_DEPENDENCY_INSTALL` are one state. Apply and verify preview
before production.

### Workers Previews

The release ledger and the release diffs build their branches as
[Workers Previews](https://developers.cloudflare.com/workers/previews/): each preview
`deploy_command` names the `preview` mode. The ledger's `wrangler.jsonc` carries the `previews`
block `wrangler preview` requires, and a Preview binds only what that block names, so a branch
reaches none of the ledger's production data, while each Preview gets Durable Object namespaces of
its own. `cf previews deploy` evaluates the release diffs' `cloudflare.config.ts` with `isPreview`
set, so that config, not a `previews` block, decides what its Previews bind: the
`release-diffs-preview` R2 bucket in place of `release-diffs`, so the release diffs' own branches
build apart from production's. A service binding always calls the bound Worker's production
deployment, even from a Preview, so a docs-site branch that binds the release diffs reaches
production's worker and bucket. Its `ReleaseDiff` Durable Object class is declared in the config's `exports`
map, which takes the place of wrangler's `migrations` list. The
ledger's routes, cron trigger and queue consumers stay with production. The docs site still uploads
versions.

Cloudflare's switch to Previews is one-way, and it replaces the Worker's preview trigger with a
Previews base config on the Worker itself, which `check:workers-builds` diffs and patches in the
trigger's place. The switched command applies to every branch at once, so a branch whose checkout
predates the `preview` mode fails its preview build until it is rebased.

A branch's first push copies the base config into a per-branch trigger, which later applies never
touch and `cf builds triggers list` does not return. Branches first pushed before 2026-11-03T18:21Z
copied `build_command` as `./tools/workers-builds/cloudflare-build.sh`, so
[`cloudflare-build.sh`](../tools/workers-builds/cloudflare-build.sh) stays as a shim over the `.ts`
until none of those branches remain.

### Preview deployments on GitHub

[`preview-deployments.yml`](../.github/workflows/preview-deployments.yml) runs
[`preview-deployment.ts`](../tools/workers-builds/preview-deployment.ts) when a
`Workers Builds: <worker>` check run succeeds. `post` reads the `Version ID:`, `Preview URL:` and
`Preview Alias URL:` lines of the check run's summary, and records two GitHub Deployments on the
check run's commit, each with the branch in its payload: the commit's own preview in
`preview/<worker>/commit`, then the branch alias, which always serves the branch's latest build, in
`preview/<worker>`. A PR lists the newest deployment first, so the alias heads its deployments box.
A summary without an alias gets only the `/commit` deployment. It skips a `main` build, which is a production deploy, and a Workers Previews build
whose summary names no URL. A successful branch build of any other Worker without a
`Preview URL:` line fails the job, since that means the summary format changed.

Every PR shares the environment, so the deployments are transient and `auto_inactive` never
retires them. In each environment, `post` reads every page of deployments and marks the
branch's deployments created before its own inactive, and the job runs one at a time per Worker. When a PR closes, the `retire` job runs `retire --branch` to
mark the branch's deployments in every `preview/*` environment inactive. A `pull_request` run
from a fork gets a read-only token, so that job skips forks; Workers Builds builds only this
repository's branches.

`./tools/workers-builds/preview-deployment.ts read --pr <number> --json` prints each Worker's
`branchUrl` and `commitUrl` for a PR's head. `post --check-run <id> --dry-run` and
`retire --branch <branch> --dry-run` print what the workflow would do, through `gh`.

### Unreleased docs alias at `/main/`

The unprefixed URLs are the unreleased docs, built from `main`. `/main`, `/main/` and every
`/main/<path>` answer a 302 to the same path without the prefix, query string kept, so a link to the
unreleased docs has an address that names them. The docs worker owns the redirect
(`worker/main-alias.ts`), with `/main` and `/main/*` in `run_worker_first`, so `_redirects` has no
rule for it. The build fails if a page is ever built under `/main`, where the redirect would hide
it.

### Frozen 1.x docs at `/v1/`

The docs lines live in one R2 bucket, `lit-ui-router-docs-snapshots`, which the docs worker binds as
`DOCS_SNAPSHOTS` and serves itself (`worker/snapshot.ts`). The bucket mirrors the URL space: an
object's key is its URL path without the leading slash, so `/v1/guides/` is `v1/guides/index.html`.
A line's keys sit under the paths it owns: a site-wide version such as `v1` under `v1/`, and a
package line (none is baked yet) at `packages/<pkg>/vN.html` and under `reference/<pkg>/vN/`. A
publish also writes `_manifests/<line>.json`, the record of the upload, outside every line so the
worker never serves it.

Which paths are lines comes from `public/versions.json`, bundled into the worker: each of
`others` owns its `path`, and each package line its page and reference. Every root must also be in
`run_worker_first`, bare and with `/*`, or the assets binding answers before the worker; a test
fails until it is. The route answers the way the assets binding answered for the snapshot:
`auto-trailing-slash` HTML handling (`307` to the canonical URL, query kept), the nearest
`404.html` up to the line's root at status 404, content types by extension, the object's ETag
with a `304` on a match, and `public, max-age=0, must-revalidate` except a line's hashed
`assets/`, which are immutable. A site-wide line also gets the main site's `Link` header moved
under its base and a `301` from `/v1/<mount>` to the unversioned mount for every worker row in
`catalog/surfaces.ts`, since the VitePress client renders some nav links with the `/v1/` base,
such as the mobile menu. A missing binding or a failed read answers a plain 503, never a main-site
page. Branch previews bind the same bucket, so they serve `/v1/` too; no deploy of the docs site
writes to it, and the docs build and its tests run without it.

The repo keeps a manifest instead of the files:
[`catalog/snapshots/v1.json`](lit-ui-router.dev/catalog/snapshots/v1.json) records the tag, the file
count, the byte total, a digest (the sha256 of the `sha256sum` listing of every assets file, sorted
by path) and each page's canonical target. The docs build fails if a target is neither a built page
nor a `catalog/redirects.ts` source, so moving a page that 1.x points at owes a redirect. It also
fails if `sitemap-pages.xml`, `llms.txt` or `llms-full.txt` lists a `/v1/` URL.

[`public/versions.json`](lit-ui-router.dev/public/versions.json), served at `/versions.json`, is the
one list of docs versions, and its schema is `VersionManifest` in `.vitepress/versions.ts`. `others`
holds the site-wide snapshots, each with the `tag` it is built from, and `packages` holds each
package's lines by npm name: a line's id (`v0`, `v1`), the tag it was baked from and whether it is
`current` or `frozen`. No package line is baked yet, so `packages` is empty. The version menu reads
it through `.vitepress/lines.ts`: a package's page and reference list that package's lines, the
guides list the site-wide versions, which `lit-ui-router`'s pages list too until it has a line of
that major, and the menu is hidden where one entry or none is left: a package with no line, the
reactivity hubs and the package and reference indexes, the site page and the release stubs. A build fetches the live manifest, so a frozen build lists what
was baked after it, as far as its own menu reads the manifest: the published `/v1/` snapshot
predates package lines and lists the site-wide versions only, until it is rebuilt.

To produce, publish or replace the snapshot (mise and git required; `cf` logged in to the account):

1. Build this checkout's site: `mise exec -- turbo run build --filter=@www/lit-ui-router.dev`.
2. `pnpm run docs:snapshot` in the site package
   ([`scripts/docs-snapshot.ts`](lit-ui-router.dev/scripts/docs-snapshot.ts)). It checks out the tag
   named as the version's `tag` in `public/versions.json` in a throwaway worktree,
   copies in this checkout's version banner and menu, runs `mise run setup` and the site's turbo
   build there, then rebuilds the site with `vitepress build --base /v1/` into
   `www/v1.versions.lit-ui-router.dev/dist/v1/` (gitignored). It removes what the main site serves
   (`_headers`, `_redirects`, the sitemaps, `robots.txt`, `versions.json`, the sample-app shells and
   bundles, the release-page script and stylesheet), points links into the worker's mounts at the
   unversioned paths, moves the embedded examples under `/v1/examples/`, and rewrites `llms.txt` and
   `llms-full.txt` to list the `/v1/` pages. Last, it gives every page a canonical link to the same
   path in step 1's build, else where `catalog/redirects.ts` sends it, else the home page, and
   writes `_redirects` and `_headers`, which only the retiring assets-only Worker reads.
   `--bake-only` redoes only that last step.
3. `pnpm run docs:snapshot:publish -- --dry-run`, then without `--dry-run`
   ([`scripts/docs-snapshot-publish.ts`](lit-ui-router.dev/scripts/docs-snapshot-publish.ts)). It
   uploads the line's files to the bucket with `cf r2 objects put`, then the upload record, and
   writes the manifest; commit it. It is safe to rerun: when the digest equals the committed
   manifest's and the bucket's record matches, it uploads nothing, and otherwise it uploads only
   the files whose MD5 differs from the bucket's ETag. Objects the new build lacks stay in the
   bucket. It spaces its requests under the API's limit of 1200 per five minutes and backs off on
   a 429, so a first upload of `/v1/` takes about ten minutes.

The snapshot is refreshed by hand, once per release round and not per release: when the last
package of a round has published, set the version's `tag` in `public/versions.json` to that release's tag and run the three steps
again. A round that changes no 1.x page owes no refresh. The last 1.x tag before 2.0 lands on `main`
always gets one; after that, a 1.x fix reaches the snapshot the same way, from the branch cut from
the last tag.

### Adding a site

1. Add the package at `www/<domain>/`, named `@www/<domain>`, with a `wrangler.jsonc` or a
   `cloudflare.config.ts` beside its `package.json`. A D1 database the production deploy should
   migrate sets `migrations_dir`, which only `wrangler.jsonc` has. A
   Worker with no hostname of its own still takes a key under `lit-ui-router.dev`, since the
   build and deploy scripts accept only a domain-shaped one.
2. Add an entry keyed `<domain>` to
   [`workers-builds-triggers.config.jsonc`](../tools/workers-builds/workers-builds-triggers.config.jsonc),
   with both commands taking the key and `path_includes` limiting its builds to the paths it
   reads. The trigger test checks the entry against the package.
3. In the Cloudflare dashboard, **Workers & Pages → Create → Import a repository**, with the
   Worker name matching the one its config names and the build and deploy commands from the
   entry. Give its builds an API token of its own, scoped to what that site's deploy touches.
4. Run `pnpm check:workers-builds -- --site <domain>`, and `--apply` for anything it reports.
5. Give its config the `observability` block the other sites have, as
   [OBSERVABILITY.md](./OBSERVABILITY.md#operating-it) describes; a test fails until it matches.

### Dashboard as Code

The private [`tools/workers-builds`](../tools/workers-builds) package owns
[`workers-builds-triggers.config.jsonc`](../tools/workers-builds/workers-builds-triggers.config.jsonc), which mirrors
the dashboard values above plus the declared [build environment variables](#build-environment-variables),
and diffs it against the live triggers: `pnpm check:workers-builds` is read-only
(exit 1 on drift); `pnpm check:workers-builds -- --apply` updates. Both walk every entry by
default; `--site <key>` (repeatable, or one comma-separated value) limits the diff and the apply to
the named entries, and an unknown key is a usage error (exit 2) rather than an empty selection.

The config is keyed by site, one entry per Worker the repo deploys, each naming the
`wrangler.jsonc` or `cloudflare.config.ts` the worker is named in and pinning what it pins, the
[build watch paths](https://developers.cloudflare.com/workers/ci-cd/builds/build-watch-paths/)
among them, which are what let two sites share one repo. Its shape is documented where it is enforced — the
file's own comments and the schema in
[`workers-builds-triggers.core.ts`](../tools/workers-builds/workers-builds-triggers.core.ts) — and
not repeated here. A `workerConfig` that names no file is a hard error (exit 2), never a skipped
entry, so a moved file cannot turn the check green. A `cloudflare.config.ts` is evaluated with
`@cloudflare/config`, the loader `cf` itself uses, at the version `cf` pins; the trigger test fails
when the two drift apart.
A configured worker the account does not have yet is drift (exit 1), not an error: a new site
reads as owing its dashboard step without hiding the other sites' verdicts.

Requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The token must be **user-scoped** — account-owned
tokens do not cover the Workers Builds API — and carry two permissions: **Workers Scripts: Read**, which
resolves the worker name to the tag the triggers endpoint is keyed by, and **Workers Builds Configuration:
Read** for the diff itself, raised to **Edit** only for `--apply`.

Applying is manual-only: `--apply` writes production deploy configuration, and no automation holds an
Edit-scoped token.

Both belong in `.config/mise/cloudflare.local.env`, a gitignored dotenv that the checked-in
`.config/mise/config.toml` loads via `[env] _.file` (the same mechanism as the
[Remote Cache](../docs/REMOTE_CACHE.md) credentials, but a separate file — `mise run turbo_login` rewrites
that one). It is deliberately not symlinked into git worktrees, so run `check:workers-builds` from
the owning checkout.

From 1Password, two mise tasks wrap `op` over gitignored files that hold `op://` references instead
of values (no secrets, but the vault layout they encode is personal rather than repo config, so they
stay untracked). A third task creates both files and the item they point at:

| Task                                                      | Reads / writes                                                                      | Reference form | Token at rest               |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------- | --------------------------- |
| `mise run cloudflare_item_create`                         | writes `.config/mise/cloudflare.local.env.tmpl` + `.config/mise/cloudflare.op.env`  | both           | no                          |
| `mise run cloudflare_login`                               | reads `.config/mise/cloudflare.local.env.tmpl`                                      | `{{ op://… }}` | yes, `chmod 600`            |
| `mise run check_workers_builds [--site <keys>] [--apply]` | reads whichever exists: the dotenv (via mise) else `.config/mise/cloudflare.op.env` | bare `op://…`  | only if it found the dotenv |

`cloudflare_item_create` is the one-time bootstrap: it creates a Secure Note (`--vault Private`,
`--title lit-ui-router-workers-builds`) whose two fields are named after the variables and left
**empty**, then writes both reference files pointed at it. Fill the fields in 1Password afterward —
the task never writes a credential. It is idempotent on the item: an existing one is left untouched,
and the two files are only rewritten with `--force`.

`cloudflare_login` regenerates the dotenv above with `op inject`, so edit the template and re-run
rather than editing the dotenv.

`check_workers_builds` picks its credential source rather than asking you to remember which one is
set up. If `cloudflare.local.env` exists, mise's `[env] _.file` has already put both variables in the
task's environment, so it runs the diff directly and warns that it did — wrapping that in `op run`
would prompt for authorization on every invocation to re-resolve values the process already holds.
With no dotenv it runs under `op run --env-file`, which injects into that process only: the
no-secrets-at-rest path, and the one to prefer for `--apply`, whose **Edit**-scoped token is the one
worth never writing to disk. Deleting the dotenv is what switches back — after an `--apply`, that is
worth doing, since the file outlives the write it was created for.

One file per task, because the two syntaxes are mutually exclusive: `op inject` substitutes
`{{ op://… }}` and passes a bare `op://…` through untouched, so pointing it at the `op run` file
yields a dotenv of literal reference strings, surfacing as an auth failure from Cloudflare rather
than as an error from `op`.

None of the three is required — they only supply the two variables, so `pnpm check:workers-builds`
with them already in the environment works the same. `op` is deliberately not a pinned `[tools]`
entry: a mise-managed copy would shadow the system one and lose its desktop-app integration.

#### CD-pipeline verification signal

[`release-signals.yml`](../.github/workflows/release-signals.yml) runs the same read-only diff on every push to
`main` — the push that Workers Builds deploys from — plus a daily sweep, and reports it as the
`workers-builds (triggers)` check run alongside its `published-diff` and `peer-floor` siblings. It is
non-gating: green in sync, orange (`action_required`) on drift, gray (`neutral`) when the check could not run.
It never applies; resolving drift is still a local `--apply`.

The badge for it sits at the top of this file and in the README header. It diffs the live Cloudflare Workers Builds triggers that ship
[lit-ui-router.dev](https://lit-ui-router.dev) against the repo-owned
[desired state](../tools/workers-builds/workers-builds-triggers.config.jsonc):

| Badge                                                                        | Meaning                                                                   |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| ![passing](https://img.shields.io/badge/workers--builds-passing-brightgreen) | The dashboard triggers match the repo config                              |
| ![passing](https://img.shields.io/badge/workers--builds-passing-orange)      | The dashboard drifted — a manual `--apply` is owed                        |
| ![neutral](https://img.shields.io/badge/workers--builds-neutral-lightgrey)   | Could not verify (no/expired token, API outage) — not a claim about drift |

The order of `--apply` and merge depends on the value. A self-contained one — an environment
variable, or a command that names no repo file — is applied _before_ the merge: a trigger
snapshots its environment when a build is enqueued, so pushing first spends one build on the
old config.

The trap is the other case. When the value being applied names a file in the repo — as `build_command` and
`deploy_command` both do, pointing at [`cloudflare-build.ts`](../tools/workers-builds/cloudflare-build.ts)
and [`cloudflare-deploy.ts`](../tools/workers-builds/cloudflare-deploy.ts) — the apply has to
_follow_ the merge, or it breaks the preview build of every branch that does not have the file yet.
But the push-triggered run fires seconds after that merge, so it necessarily reads the pre-apply
dashboard: the badge goes orange on a dashboard that is about to become correct, and nothing
re-triggers it afterward. Finish the `--apply` with a re-dispatch, or it stays orange against a
converged dashboard:

```sh
gh workflow run release-signals.yml --ref main
```

After a merge-first apply, an open PR's preview build passes only once it is rebased onto `main`.

Two repository secrets drive it. Both are optional — absent, the signal reports gray rather than failing:

| Secret                  | Value                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`  | A **user-scoped** API token with **Workers Scripts: Read** and **Workers Builds Configuration: Read** — both, or the run 403s on the tag lookup before it reaches the triggers. CI must never hold the Edit scope. |
| `CLOUDFLARE_ACCOUNT_ID` | The Cloudflare account ID. A secret rather than a variable so it stays out of public logs.                                                                                                                         |

Rotation is manual: mint a replacement in the Cloudflare dashboard under **My Profile → API Tokens** (user
tokens, not **Manage Account → API Tokens**), update the repository secret, and revoke the old one. A stale
token shows up as the grey `workers-builds (triggers)` badge, not a red run.

### Build Environment Variables

Managed per key, not per map: `check:workers-builds` diffs only the keys declared in
[`workers-builds-triggers.config.jsonc`](../tools/workers-builds/workers-builds-triggers.config.jsonc)
and leaves every other variable on the trigger untouched.

**Declared** (plaintext, committed, `--apply` writes them):

- `SKIP_DEPENDENCY_INSTALL=1` — **required.** Hands the dependency install to
  `cloudflare-build.ts`, per [Build & Deploy Commands](#build--deploy-commands). Without it, Cloudflare
  runs its own corepack-provisioned `pnpm install` first and the build fails there;
  deleting it in the dashboard breaks every deploy.
- `CYPRESS_INSTALL_BINARY=0` — skips the Cypress binary download during the install. No
  workspace package depends on Cypress now that the e2e suite runs on Playwright, so the
  variable has no effect on a current checkout.
- `HUSKY=0` — the root `prepare` script installs git hooks, which mean nothing in a build
  container. Matches the `env: HUSKY: 0` every CI workflow sets.

**Unmanaged** (dashboard-only; listed in the diff output as `(unmanaged)`, never diffed or patched):

- `VITE_GOOGLE_ANALYTICS_TRACKING_ID`
- `TURBO_`-prefixed [Remote Cache](../docs/REMOTE_CACHE.md) variables and secrets

Drift semantics for a declared key: a wrong or absent live value is drift and is patched; a key
the dashboard has marked secret is reported and **not** overwritten, since the config holds
plaintext only. Secrets, therefore, can never be committed here nor clobbered by `--apply`.

### Local Development

With pnpm:

```bash
pnpm --filter @www/lit-ui-router.dev wrangler:dev
```

With turbo:

```bash
turbo @www/lit-ui-router.dev#wrangler:dev
```

Both serve on port 8787. That default lives in `dev-port.ts` beside the worker,
not in any environment, so neither form needs mise. Export `WWW_DEV_PORT` to
move it — for a second worktree, put it in a gitignored
`.config/mise/config.local.toml`; the e2e app's
[README](../apps/sample-app-lit-e2e/README.md#the-port) covers why the port is
contended.

Both serve the development build of the worker's dependencies; set
`WWW_WORKER_BUILD=production` for the build that deploys (see
`lit-ui-router.dev/scripts/wrangler-dev.ts`).

#### The release pages

The worker renders `/releases/` and the pages under it from the
[release ledger](release-ledger.lit-ui-router.dev/README.md), read through the
`LEDGER` service binding in `wrangler.jsonc`. Under `/gh` it answers only the
urls GitHub lacks, such as `/gh/releases/<pkg>/latest`, a redirect to that
package's latest GitHub release. The route tables are
[`worker/releases/routes.ts`](lit-ui-router.dev/worker/releases/routes.ts).
`/releases/<pkg>/diff/<from>...<to>/` is a shell the worker validates against
the ledger; its one script, `/release-diff.js`, renders the patch `npm diff`
would print beside a
[`@pierre/trees`](https://www.npmjs.com/package/@pierre/trees)
file tree. Presets narrow both to source, published JS, types or all files;
`?files=js|types|all` names any but the default, source (their labels and url
handling live in
[`worker/releases/npm-diff/file-filter.ts`](lit-ui-router.dev/worker/releases/npm-diff/file-filter.ts)).
The docs build
emits that script from
[`worker/releases/release-diff.ts`](lit-ui-router.dev/worker/releases/release-diff.ts)
in a Vite build of its own (`.vitepress/vite.config.ts`).

The browser never fetches a tarball. The script reads the page's data routes,
`<layout>/index.json`, `<layout>/files/<preset>` and `<layout>/patch`, which the
worker answers only for a pair the ledger validates and the layout this build
imports from the release-diffs package. Each calls the method of the same name on the
`RELEASE_DIFFS` service binding, the
[release-diffs worker](release-diffs.lit-ui-router.dev/README.md)'s default
entrypoint, which builds a pair once and keeps it in R2. The index lists the
presets each file belongs to. The answers are immutable, so the Cache API keeps
them without refreshing (`cacheKey` in `worker/releases/states.ts`). A failed
call answers 503 and is never cached.

Preview uploads bind the production ledger and release-diffs workers the same
way. Locally the bindings reach only workers running in another dev process,
and the pages answer 503 without one. To serve fixture rows, pass both configs,
the docs worker's first; the diff pages' data routes still answer 503:

```bash
pnpm --filter @www/lit-ui-router.dev wrangler:dev -c wrangler.jsonc -c worker/test/ledger-stub/wrangler.jsonc
```

See Cloudflare Workers Testing Docs: [Local Development](https://developers.cloudflare.com/workers/testing/local-development/)

## [Cloudflare Pages](https://developers.cloudflare.com/pages/): The Altitude Atlas

[![Build and Test - Altitude Atlas](https://img.shields.io/github/check-runs/simshanith/lit-ui-router/www%2Fatlas?nameFilter=build_and_test%20%28branch%29%20%2F%20run&label=Build%20and%20Test%20-%20Altitude%20Atlas)](https://github.com/simshanith/lit-ui-router/actions/workflows/build-test-branch.yml?query=branch%3Awww%2Fatlas)
[![E2E - Altitude Atlas](https://img.shields.io/github/check-runs/simshanith/lit-ui-router/www%2Fatlas?nameFilter=build_and_test%20%28branch%29%20%2F%20e2e%20result&label=E2E%20-%20Altitude%20Atlas)](https://github.com/simshanith/lit-ui-router/actions/workflows/build-test-branch.yml?query=branch%3Awww%2Fatlas)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fatlas.lit-ui-router.dev)](https://atlas.lit-ui-router.dev)
[![Deploy - Altitude Atlas](https://img.shields.io/github/check-runs/simshanith/lit-ui-router/www%2Fatlas?nameFilter=pages-deploy%20%28altitude-atlas%29&label=Deploy%20-%20Altitude%20Atlas)](https://github.com/simshanith/lit-ui-router/actions/workflows/release-signals.yml)

The Altitude Atlas is a drawing set of this repository and a consumer app served by
`lit-ui-router-ssr`. It lives in `www/atlas.lit-ui-router.dev/` on the `www/atlas` branch and
never on `main`: `main` merges into `www/atlas`, nothing merges back, and the app pins the
published packages it draws, so every sheet measures a release. The tree's own README holds
the build and deploy recipe.

- **Branch.** `www/atlas` runs the same [`build-test-branch.yml`](../.github/workflows/build-test-branch.yml)
  lane every branch gets, with the atlas tree inside the graph, so the root lint lanes cover
  the app too. It has no PR lane: the branch takes direct pushes.
- **Site.** [atlas.lit-ui-router.dev](https://atlas.lit-ui-router.dev) is the Cloudflare Pages
  project `altitude-atlas`, production branch `www/atlas`. A deploy is a `wrangler pages deploy`
  direct upload from a checkout of the branch, so no build check reports it. The deploy badge is
  the `pages-deploy (altitude-atlas)` check run that [`release-signals.yml`](../.github/workflows/release-signals.yml)
  posts on the branch head: it compares the latest production deployment's commit with that head.
