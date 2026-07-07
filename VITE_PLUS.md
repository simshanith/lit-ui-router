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
