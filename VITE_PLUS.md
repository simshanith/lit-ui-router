# Vite+ (`vp` / `vpr`) Evaluation

Hands-on evaluation of [Vite+](https://viteplus.dev) (npm package `vite-plus`) as a
replacement for or complement to Turborepo in this monorepo. Evaluated 2026-07-07 against
`vite-plus@0.2.2` (0.2.3 was published the same day; pnpm's `minimumReleaseAge` resolved
the catalog to `^0.2.2`) and `turbo@2.10.3`.

## What Vite+ is

Vite+ is VoidZero's unified toolchain CLI. One `vp` binary fronts a pinned set of tools:

| Tool            | Version (in 0.2.2) |
| --------------- | ------------------ |
| vite            | 8.1.2              |
| rolldown        | 1.1.4              |
| vitest          | 4.1.9              |
| oxlint          | 1.72.0             |
| oxfmt           | 0.57.0             |
| oxlint-tsgolint | 0.24.0             |
| tsdown          | 0.22.3             |

`vp` subcommands span dev/build/test/lint/fmt/check plus a full pnpm-style package
manager (`install`, `add`, `why`, ...). The task-runner half is `vp run`; **`vpr` is
literally a standalone shorthand for `vp run`** — same help text, same flags.

`vp run`:

- Runs `package.json` scripts (uncached by default) or tasks declared in
  `vite.config.ts` under `run.tasks` (cached by default, with `command`, `dependsOn`,
  `input`/`output`, `env`, `cache` fields).
- Orders workspace packages **topologically from `package.json` dependencies**
  (pnpm-workspace.yaml is understood natively).
- Selection: default = current package, `-r` all packages, `-t` package + transitive
  deps, `--filter` by name/dir/glob with pnpm-style `...` traversal suffixes.
  `-r` and `--filter` are mutually exclusive.
- Caching: task cache in `node_modules/.vite/task-cache`, fingerprinting args + env +
  inputs. Inputs are **auto-tracked via filesystem monitoring** by default; explicit
  `input`/`output` globs only in `vite.config.ts` tasks. `--cache` / `--no-cache`
  force either mode; `vp cache clean` clears.
- Default concurrency is 4 (`--concurrency-limit`, `--parallel`).

## Licensing reality

Vite+ was announced (Oct 2025) as a commercial product — free for individuals/OSS/small
business, flat fee for startups. **VoidZero reversed that**: the alpha shipped fully MIT
and free, and after Cloudflare acquired VoidZero (June 2026) Cloudflare pledged Vite,
Vitest, Rolldown, Oxc, and Vite+ remain MIT. So for this OSS repo there is no licensing
obstacle today; the residual risk is stewardship (single-vendor, pre-1.0, alpha).

## Feature matrix vs Turborepo 2.10

| Capability             | turbo 2.10                                                | vite-plus 0.2.2                                                                             |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Task declaration       | `turbo.json` over `package.json` scripts                  | `package.json` scripts OR `vite.config.ts` `run.tasks` — **same name in both = hard error** |
| Cross-package ordering | `dependsOn: ["^build"]`                                   | topological order from package.json deps (`-r`, `-t`)                                       |
| Task-level `dependsOn` | yes, incl. cross-task (`build` → `build:custom-elements`) | only for `vite.config.ts` tasks, not for scripts                                            |
| Root tasks / `with`    | `//#lint:root`, `with: ["//#test:root"]`                  | none — root package is just another workspace package                                       |
| Caching scripts        | yes (inputs/outputs in turbo.json)                        | opt-in `--cache`, inputs auto-tracked, **no way to scope inputs/outputs for scripts**       |
| Remote cache           | yes (this repo: Cloudflare Workers, see REMOTE_CACHE.md)  | **none**; experimental GitHub Actions cache save/restore of the local cache dir             |
| Persistent/dev tasks   | `persistent: true`, `cache: false`                        | no persistent concept; `--parallel` for dev servers                                         |
| Env fingerprinting     | `env`, `passThroughEnv`, `globalEnv`                      | auto env fingerprinting + `env` field on config tasks                                       |
| Watch mode             | `turbo watch`                                             | none for the runner (vite/vitest have their own)                                            |
| Filtering              | `--filter` incl. git-range `[HEAD^1]`                     | `--filter` name/dir/glob/traversal; **no git-based filtering**                              |
| Bundled toolchain      | none (BYO)                                                | vite/vitest/oxlint/oxfmt/tsgolint pinned inside                                             |
| Maturity               | stable, years in prod                                     | alpha; docs mark caching-in-CI experimental                                                 |

## Timings (M-series laptop, this repo)

| Run                                                                                                                       | Result                                            |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `turbo run build --force` (cold, full graph: 13 tasks incl. `build:custom-elements`, `examples#build:embeds`, `docs:api`) | **28.6s**                                         |
| `turbo run build` (warm)                                                                                                  | **1.8s**, 13/13 cached                            |
| `vpr` build, 8 `build` scripts, cold (`--cache`)                                                                          | **8s**                                            |
| `vpr` build, warm (`--cache`)                                                                                             | **6s**, 5/8 cache hits                            |
| `vp test` in `packages/lit-ui-router`                                                                                     | 13.0s, 465/465 pass (baseline `pnpm test`: 12.5s) |
| `vp lint` (oxlint) in `packages/lit-ui-router`                                                                            | ~0.4s, 3 warnings on eslint-clean code            |
| `vp fmt --check` (oxfmt) in `packages/lit-ui-router`                                                                      | 0.4s, **21/26 files differ from prettier**        |

Cold numbers are not apples-to-apples: vp only sees the plain `build` scripts, while
turbo's graph also runs `cem analyze`, the examples `npm ci` embeds, and typedoc.

## Findings

1. **Script/task name conflict blocks incremental adoption.** Declaring
   `run.tasks.build` in `apps/sample-app-lit-vanilla/vite.config.ts` while the
   `build` script exists fails hard:
   `Task sample-app-lit-vanilla#build conflicts with a package.json script of the same
name`. Turbo discovers tasks from `package.json` scripts, so any task migrated into
   `vite.config.ts` (to get `dependsOn`/`input`/`output`) _disappears from turbo's
   graph_. You must pick one runner per task name — coexistence is per-task
   all-or-nothing.
2. **Auto input tracking never caches this repo's vite builds.** The three
   vite/vitepress builds are permanently uncacheable under `--cache`:
   `Not cached: read and wrote 'apps/.../dist/images/64/chevron-down.png'` —
   vite-plugin-static-copy (and vitepress) read back what they write into `dist/`.
   The fix (explicit `input: ['!dist/**']`, `output: ['dist/**']`) requires config
   tasks, which finding 1 forbids while turbo owns the scripts.
3. **Graph edges live in turbo.json and vp can't see them.** `vpr` misses
   `lit-ui-router#build:custom-elements` (runs _before_ build via workspace
   turbo.json), `docs#build`'s `^docs:api` dependency, `examples#build:embeds`, and
   all `//#` root tasks / `with` couplings. A vp-only build produces incomplete
   artifacts (no custom-elements manifest, no API docs).
4. **Root-package recursion.** `vpr -r build` includes the workspace root, whose
   `build` script is `turbo run build` — vp launched turbo inside itself and then
   _cached the recursive turbo run_. vp inlines nested `vp run` but has no idea about
   nested turbo. Any wiring must filter the root package out (see `vp:build` script).
5. **Vitest: mixed-version run, but the pnpm patch survived.** `vp test` runs its
   bundled vitest 4.1.9 against this workspace's `@vitest/browser@4.1.10` +
   `@vitest/browser-playwright@4.1.10`: vitest prints
   `Running mixed versions is not supported and may lead into bugs`. All 465 browser
   tests passed anyway. Surprisingly, pnpm applied `patches/@vitest__browser.patch` to
   **both** copies (the unversioned `patchedDependencies` entry covered vite-plus's
   nested `@vitest/browser@4.1.9`, and the content-hashed
   `tester-BJtsJFpD.js` filename happens to match across 4.1.9/4.1.10). That is luck,
   not design: the moment vp's bundled vitest diverges to a different bundle hash, the
   patch fails to apply and installation breaks — or worse, silently no-ops if the
   patch is ever made version-scoped. The repo cannot control vp's vitest version;
   it moves with vite-plus releases.
6. **oxlint/oxfmt are not drop-ins.** oxlint flags 3 warnings on eslint-clean code
   (different rule set; also no eslint-plugin-turbo / package-json plugin coverage).
   oxfmt would reformat 21/26 files in `packages/lit-ui-router` vs prettier. Adopting
   `vp lint`/`vp fmt` means migrating lint config and reformatting the repo — a
   separate decision from the task runner.
7. **Filter footguns.** `--filter ./packages` (no glob) silently matches nothing and
   exits 0 — a run that "passes" while running zero tasks (there is an opt-in
   `--fail-if-no-match`). `-r` cannot be combined with `--filter`.
8. **No remote cache.** Cache is a local directory; the documented CI story is
   `actions/cache` save/restore of `node_modules/.vite/task-cache`, explicitly marked
   experimental and "not a remote cache substitute". This repo already has a working
   turbo remote cache on Cloudflare Workers shared between CI and dev.

## What works well

- Zero-config topological builds: `vpr` + filters ran the 8 workspace `build` scripts
  in correct dependency order with no configuration at all.
- The cache diagnostics are excellent: `vp run --last-details` names the exact file
  (`cache miss: 'src/utils.ts' modified`) or reason per task.
- `vp test` ran the full Playwright browser-mode suite unmodified.
- Compound `&&` commands split into separately cached sub-tasks; nested `vp run`
  calls are inlined instead of spawning.

## Try it

```sh
corepack pnpm run vp:build        # workspace build via vpr, root package excluded
corepack pnpm exec vp run --last-details
corepack pnpm exec vp cache clean
```

## Local dev alongside turbo

Follow-up evaluation (2026-07-07): even with the CI verdict settled (turbo stays), is
vp worth using on a developer workstation? Scenarios tested hands-on, fair scope —
turbo's `--only` flag runs exactly the same 8 `build` scripts vp runs, no `dependsOn`
edges, isolated `TURBO_CACHE_DIR`.

### Rebuild timings, fair scope (identical 8 scripts)

| Scenario                                       | turbo `--only`      | `vpr --cache`                         |
| ---------------------------------------------- | ------------------- | ------------------------------------- |
| Fully cold (both caches empty)                 | 8.93s               | 8.16s                                 |
| Warm, no changes                               | **0.27s** (8/8 hit) | 5.86s (5/8 — vite builds never cache) |
| Incremental (`lit-ui-router/src` comment edit) | 8.39s (2 hit)       | **6.55s** (4/8 hit)                   |
| `touch` all mtimes, content identical          | full hit            | full hit (content-hashed)             |
| Branch switch A→B→A (content restored)         | **0.28s** (8/8 hit) | re-runs changed tasks every flip      |

Notable results behind the table:

- **turbo's local cache is worktree-shared and multi-entry.** Turbo detects git
  worktrees and uses one cache at the main repo root (`.turbo/cache`,
  `is_shared_worktree=true`), keyed by content hash with every historical entry kept —
  so branch ping-pong and parallel worktrees stay warm. **vp keeps only the latest
  fingerprint per task**: an A→B→A content flip re-runs the task on every flip even
  though vp's fingerprint is content-based (verified: `touch`-only is a 100% hit,
  A→B→A is a miss).
- **vp's file-level tracking is more precise than turbo's package-level hashing.**
  After a comment-only edit in `lit-ui-router/src/index.ts`, vp correctly _hit_
  `lit-ui-router-mobx#build` (its tsc only reads the unchanged `.d.ts` files) while
  turbo's `^build` re-ran it. That precision is real — but it's swamped by the three
  never-cacheable vite/vitepress builds in every run.

### Inner loop (single package / app)

- `vp test` is the bundled vitest CLI verbatim, so watch mode etc. all exist — but a
  single-spec run is 3.00s vs 2.64s with the workspace vitest, plus the permanent
  "Running mixed versions is not supported" warning. No win.
- `vp dev` serves `apps/sample-app-lit-vanilla` fine (checked on :5199) — **using the
  vite 8.1.2 bundled inside `@voidzero-dev/vite-plus-core`, not the workspace's pinned
  vite 7.3.6** (verified from the bundled `logger.js`). The app's plugins
  (checker, static-copy, codecov) are installed and CI-tested against vite 7; running
  them under vite 8/rolldown locally is silent major-version skew (it already surfaces
  a rolldown deprecation warning about `optimizeDeps.esbuildOptions`). Scripts run via
  `vpr` still use the workspace vite 7 — only the direct `vp dev` / `vp build`
  subcommands skew.
- **vp has no `turbo watch` / `turbo run dev` equivalent** — nothing rebuilds
  workspace deps while a dev server runs. `vpr -t --cache build` from an app dir is a
  usable _manual_ pre-dev step (builds the app's dependency chain, 4 tasks, cache-aware),
  but it's one-shot.

### oxc version skew (vs PRs #231/#232)

The incoming oxlint/oxfmt PRs pin oxlint 1.73.0 / oxfmt 0.58.0; vite-plus 0.2.2
bundles 1.72.0 / 0.57.0. Tested with the PR branches' configs:

- The _engines_ mostly agree: bundled oxlint 1.72 with `-c .oxlintrc.json` produces
  the **identical 5 warnings** as standalone 1.73; oxfmt 0.57 vs 0.58 `--check`
  disagree on exactly **one file today** (`docs/guides/reactive-components.md`) — after
  #232 lands, a `vp fmt` would rewrite it to 0.57 style and CI's 0.58 `format:check`
  would fail.
- The real hazard is the **vp frontends, not the versions**: bare `vp lint` does NOT
  pick up the root `.oxlintrc.json` (10 unrelated default-config warnings, and it
  _misses_ all 5 real `turbo/no-undeclared-env-vars` warnings), and bare `vp fmt
--check` flags ~150 files vs 28 for the bare bundled oxfmt binary with the same
  config. The bundled _binaries_ run bare discover the config correctly; only the
  `vp lint`/`vp fmt` subcommands substitute their own defaults. Explicit
  `-c .oxlintrc.json` / `-c .oxfmtrc.json` restores exact parity.

Hard rule once the oxc PRs land: **never run bare `vp lint`/`vp fmt` here** —
local-clean/CI-dirty in both directions. With explicit `-c` they are near-parity,
minus the one-file 0.57/0.58 drift.

### PATH robustness

`mise x npm:vite-plus@0.2.2 -- vp` works exactly like the repo's `npm:turbo` mise
tool, and a global `vp` detects and defers to the workspace-local `vite-plus`
version (same global→local pattern as turbo). `vp`/`vpr` are node scripts, so they
inherit the same node-on-PATH exposure as everything else — but they _do_ remove the
`corepack pnpm exec` wrapper layer for test/lint/fmt/dev, and as a bare mise shim
`vpr` sidesteps the turbo-via-pnpm relative-path spawn bug by construction. A modest,
real ergonomic win; nothing more.

### Mixed-vitest failure mode, spelled out

Today: every `vp test` prints a loud
`Running mixed versions is not supported and may lead into bugs` banner (bundled
vitest 4.1.9 + workspace `@vitest/browser@4.1.10`), and tests pass. The repo's
`@vitest/browser` patch currently reaches vp's nested 4.1.9 copy only because the
unversioned `patchedDependencies` entry matched and the content-hashed
`tester-BJtsJFpD.js` filename is identical across 4.1.9/4.1.10. When a future
vite-plus bump ships a vitest whose tester bundle hash differs, the patch **silently
stops applying to vp's copy** (see the existing patch-regen runbook): `vp test` then
resurfaces the recursive `response:*` echo cascade in the `target="_blank"` specs —
loud, flaky-looking failures with an obscure cause, local-only (CI never runs vp).
Acceptable for a dev who knows the signature; a trap for anyone else.

### Cache hygiene

Everything vp writes lives in `node_modules/.vite/task-cache` (576 KB after all runs
here) — inside git-ignored `node_modules`, so it cannot be committed, and turbo hashes
only git-tracked inputs (`$TURBO_DEFAULT$`), so vp's cache cannot perturb turbo keys.
`git status` stayed clean across every vp invocation. `vp cache clean` removes it.

### Conditions table

| You want to…                                             | Use                                                                                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Rebuild after branch switch / rebase                     | **turbo** — shared multi-entry cache: 0.28s vs vp re-running                                                           |
| Warm no-op sanity build                                  | **turbo** — 0.27s vs 5.9s                                                                                              |
| Iterate on a low-level package, rebuild dependents       | either; **vp** is slightly faster (6.6s vs 8.4s) via file-level hits                                                   |
| One-shot topo build of an app's dep chain before hacking | **vp** (`vpr -t --cache build`) — zero config, or `turbo build --filter=<app>...`                                      |
| See _why_ something rebuilt                              | **vp** (`vp run --last-details`) — best-in-class diagnostics; turbo needs `--dry-run`/`--summarize`                    |
| Run tests (any mode)                                     | **workspace vitest** via pnpm scripts — vp = mixed-version warning + patch-decay trap                                  |
| Dev server                                               | **`pnpm dev` / `turbo dev`** — `vp dev` runs bundled vite 8 against vite-7-pinned plugins                              |
| Watch deps + dev server together                         | **turbo watch** — vp has nothing                                                                                       |
| Lint / format (after #231/#232)                          | **pinned oxlint/oxfmt via scripts** — bare `vp lint`/`vp fmt` uses wrong config; `-c` required and versions still skew |
| Produce artifacts CI will trust                          | **turbo** — vp misses `build:custom-elements`, `docs:api`, root tasks                                                  |

**Local-dev bottom line:** a developer on this repo gets two genuine things from vp
today — `vp run --last-details` as a cache-explanation lens, and `vpr -t build` as a
zero-config dependency-chain build. Everything else is either slower (warm builds),
riskier (test/dev/lint/fmt version and config skew), or absent (watch). Install it via
mise if those two are appealing; do not let it touch lint, fmt, tests, or dev servers
while the version skews documented above exist.

## Recommendation: wait (do not replace; alongside only in this narrow form)

**Replace turbo: no.** vp cannot express this repo's graph (`build:custom-elements`,
`^docs:api`, `//#` root tasks, `with`), cannot cache the vite builds it runs, has no
remote cache, and the script/task name-conflict rule makes gradual migration
impossible — it would be a flag-day rewrite of every `package.json` + `turbo.json`
into `vite.config.ts` tasks, on an alpha tool.

**Alongside: only as a convenience.** The `vp:build` script is safe (turbo remains the
source of truth; vp just runs the same scripts), and `vp run --last-details` is a nice
lens. Do not put vp in CI: cache semantics are experimental and `vp test` runs a
different (older, mixed-version) vitest than the one this repo pins and patches.

**What would have to change in vite-plus for a replace decision:**

1. Allow a `vite.config.ts` task to _wrap or extend_ a same-named `package.json`
   script (or read turbo.json), so inputs/outputs/`dependsOn` can be added without
   deleting the script other tools consume.
2. Explicit `input`/`output` (or at least output-exclusion) for plain scripts, so
   write-then-read tools (vite asset pipelines) can cache.
3. Root-task / `with` equivalent, and a `persistent` flag for dev servers.
4. A real remote cache (the Cloudflare acquisition makes an R2-backed one plausible —
   that would compete directly with this repo's self-hosted turbo cache).
5. Respect the workspace's own vitest (or match its version) instead of always running
   the bundled copy against the project's browser-mode packages.
6. Git-range filtering (`--filter=[HEAD^1]`) for affected-only CI runs.
7. Stability: 1.0, non-experimental CI caching, and a track record.

Revisit when vite-plus hits 1.0 or ships remote caching, whichever comes first.
