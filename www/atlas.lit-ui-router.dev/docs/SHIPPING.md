# Shipping the Altitude Atlas

How a change to the atlas reaches atlas.lit-ui-router.dev and the claude.ai Artifact. The build
steps themselves are owned by the files they name; this page is the order, the checks between
them, and the traps of the shell they run in. Paths are relative to this directory's parent,
`www/atlas.lit-ui-router.dev/` ("the atlas dir"); `<WT>` is the git worktree that holds it.

## Branch model

- The atlas lives on `www/atlas`, a long-lived branch off `main`. `main` merges in; nothing merges
  back. [www/DEPLOY.md](../../DEPLOY.md) names the branch and the site on `main`.
- There are no PRs on this branch. Commits land straight on `www/atlas` from the owning worktree,
  and a push deploys nothing: the Pages project `altitude-atlas` takes direct uploads, with
  `www/atlas` as its production branch.
- Two rulesets guard `refs/heads/www/atlas`: deletion, non-fast-forward and creation with no
  bypass; update with an admin bypass. Only the owner pushes.
- `app/` is a plain npm project outside the pnpm workspace. It pins the published packages
  ([app/README.md](../app/README.md)), so the atlas dogfoods what npm serves, never a workspace
  link. Companion releases arrive as floor bumps in `app/package.json` plus its lockfile.
- Sheet copy describes the present state; the record of every revision is
  [HISTORY.md](../HISTORY.md). The census plates in `data/` are refreshed as a set at one ref
  ([INITIATIVES.md](../INITIATIVES.md), "Operating notes and traps"); a shipment that changes
  no plate leaves them alone.

## The run, in order

[generator/ship.mjs](../generator/ship.mjs) owns the automated steps and the checks between
them; its header lists them. Every step has one form, run from `<WT>`:

```sh
mise exec -- node www/atlas.lit-ui-router.dev/generator/ship.mjs <step> [options]
```

Each step is one Bash call. It resolves every path from its own file, prints
`ship <step>: STOP — <why>` and exits 1 when a check fails, and exits 0 otherwise; a stop
ends the run. Long output goes to a file under the job's `tmp/`, exit code echoed, then
searched; nothing is piped to `head` or `tail`. The commit, the push and the Artifact publish
are done by hand between the steps.

1. **`build`** runs the generator: the standalone sheet pages into the gitignored `tmp/flat/`
   (an internal build product; the audit and the photographs read them there), the fragments,
   the models and the manifest ([README.md](../README.md), "Build and host"). A new plate
   needs the picture pass first (build → app → `thumbs.mjs` → build → app; `build.mjs` refuses
   a manifest whose card has no picture).
2. **`app`** typechecks and runs the vite build and prerender. The build log carries
   `prerendered N pages + 1 × 404.html · M redirects` and
   `scoped router at construction: N/N renders match router.globals`; the step stops on a
   scoped-router mismatch, and on a page count below the last run's, recorded in
   `tmp/ship/last.json`. `--accept` takes a lower count when the change removes pages on
   purpose.
3. **`audit <tag> [--only ids]`** runs `generator/audit-frames.mjs`, which exits 1 on an
   escape, a hit deeper than 1px or text over text, then `generator/shoot.mjs`, which writes
   light and dark PNGs under `tmp/shots/<tag>/`. Set the TOTAL line beside the last tag's,
   and read every picture with the Read tool, both themes, before going on. A 3D plate change
   also runs `generator/check-scenes.mjs`.
4. **Commit**, by hand, message in a file, plain git:
   `git -C <WT> commit -F <tmp>/msg.txt`. The husky `commit-msg` hook runs commitlint
   ([CONTRIBUTING.md](../../../docs/CONTRIBUTING.md#commit-conventions), rules in
   `.commitlintrc.ts`): a lowercase conventional subject such as `feat(atlas): sheet 5 rev c, …`;
   body lines of 100 characters or fewer; no body line opening with `word:` (commitlint reads
   it as a footer); a blank line before the trailer `Claude-Session: <session url>`. A
   `footer-leading-blank` warning means the blank line is missing; fix the file rather than
   accept it.
5. **Push**, by hand: `git -C <WT> push origin www/atlas`, never forced. The remote prints
   `remote: Bypassed rule violations for refs/heads/www/atlas: - Cannot update this protected ref.`
   on every push; that is the admin bypass reporting itself and the push succeeds.
6. **`stage`** runs [generator/stage-site.mjs](../generator/stage-site.mjs) in the atlas dir.
   `mise exec` supplies `VITE_ADOBE_FONTS_KIT` and `VITE_GOOGLE_ANALYTICS_TRACKING_ID` from the
   gitignored `.config/mise/cloudflare.local.env`; the step stops on `Adobe Fonts kit: none`.
   A fork worktree has no such file and never deploys (the stager's header). `dist/` is the
   staged app only; `app/dist` one level down is the raw vite build with Google font links
   and no GA tag. The stager also writes the 301 rules that land every retired `/set/…` and
   root `sheet-*.html` URL on its bare plate `/plate/<num>`, and `/set/` on `/`; its log
   names the kit and the redirect rule count.
7. **`deploy`** runs `check` first, then the Pages upload to `altitude-atlas` on branch
   `www/atlas`, and prints the deployment URL. `check` stops unless the branch is `www/atlas`,
   the atlas tree is clean, HEAD is on origin, and `dist/city/index.html` carries `typekit` and
   no `fonts.googleapis`; it also runs alone as `check`. "Deployment complete" names the
   upload, not the tree, which is why the check gates it. The deploy stands alone in its Bash
   call, and only the main session deploys.
8. **`verify [--page <path> --marker <text>]`** fetches the page twice; both fetches carry
   `typekit` and agree on the change's marker, and `/`, `/sheet/7/`, `/sheet/2a`, a retired
   `/set/` URL and `/sheet/99` answer with the codes the step lists. The first fetch after a
   deploy can read the previous deploy; a stop on disagreement is rerun once, and the
   deployment's own `*.altitude-atlas.pages.dev` URL answers at once.
9. **`artifact`** builds `app/dist-artifact/index.html`; then publish it with the Artifact tool
   by `url` (`https://claude.ai/artifact/JpLqLDXLwY8nwKByiLx5V4`), a short `label`, no icon.
   The artifact build keeps the Google font links by design ([app/README.md](../app/README.md),
   "Artifact build"); it never passes through the stager.

## Records

- **HISTORY.md.** One `## Sheet N — TITLE` section per plate, opening with the
  `- **file** … · **id** … · **current rev** X` line. A shipment that changes a plate adds a
  dated line to that sheet's **Record notes**, `- 2026-MM-DD: …`, newest first within its
  cluster (the hand-change cluster sits above the cabinet-refresh ladder, which is its own
  newest-first run). A rev letter change adds `### REV X — 2026-MM-DD` with a `**clause**`
  label and a `> REV X 2026-MM-DD: …` quote, and moves the `**current rev**` field. The build
  parses the `##` headings, `### REV` subheads and each rev's first `>` quote into `/log`
  ([generator/emit-app.mjs](../generator/emit-app.mjs), `issueLogOf`); "Notes on this record"
  at the file's foot states the contract.
- **The sheet's title block.** A plate change bumps `rev:` and DATE in the generator module;
  the `sub` is one present-state sentence plus the basis. No REV clause rides on the sheet.
- **The commit** is the narrative: what moved and why, the user's words quoted where they
  decided it, pinned numbers inside the sentence that qualifies them.
- **The memory hub line.** The session's `atlas-hub.md` gets one dated line per shipment:
  commit sha, deploy id, Artifact version, and the rule or trap the shipment taught.
- **Copy.** Sheet prose, captions and commit subjects follow [COPY.md](COPY.md).

## Environment traps

- **The worktree guard.** The Bash guard refuses any command it cannot prove stays inside the
  worktree: compound chains that name git, heredocs whose body mentions git, a grep whose
  pattern contains `git -C`, a variable standing where an option may go, the word `trap` as a
  grep pattern. Every git call is a plain `git -C <WT> <verb> …` with literal arguments, one
  per Bash call. Commit messages and scripts are written with the Write tool to the job's
  `tmp/` and passed by absolute path.
- **pnpm.** `mise exec -- pnpm …`, never `corepack pnpm`. Never pnpm inside `app/`: a `pnpm`
  install there relinks `node_modules` to the pnpm layout and leaves a stray `pnpm-lock.yaml`;
  the cure is `rm -rf app/node_modules` and `npm --prefix … ci`.
- **The shell's cwd drifts** between calls and after environment updates. `ship.mjs` resolves
  its paths from its own file; any other `--prefix` takes an absolute path.
- **zsh globs.** A glob with no match aborts the whole command line
  (`(eval):1: no matches found: …`). Quote the pattern or test the directory first.
- **Ports 8787, 5173 and 5174** belong to the e2e suite and the sample apps across every
  checkout; the atlas uses vite preview on its own port or a file:// page in Playwright.
- **Logs.** Output over a screen goes to a file, exit code echoed, then grep; a `tail` on a
  state-changing command hides its refusal.
- **Patches.** A multi-line edit to generated or large files is a `python3` script written with
  the Write tool and run by path (`python3 -I <tmp>/patch.py`); a heredoc is refused as soon
  as its body mentions git.
- **Subagents never commit, push or deploy.** They build, audit and report; the main session
  validates, commits, pushes and deploys. A subagent in a second worktree inherits the pin
  and loses git entirely.
- **The ship guard.** [generator/ship-guard.mjs](../generator/ship-guard.mjs) is a Claude Code
  PreToolUse hook on Bash. It denies a wrangler deploy that is not `ship.mjs deploy` and any
  force-push to `www/atlas`. The repo root's `.claude/settings.json`, tracked and committed on
  `www/atlas`, wires it beside the allow rule
  `Bash(mise exec -- node www/atlas.lit-ui-router.dev/generator/ship.mjs:*)`, so every checkout
  of the branch carries both; no local settings file holds a deploy command. A denial is
  reported to the user, never routed around.
- **The classifier.** The deploy and the Artifact upload carry standing authorization; a
  denial is reported to the user, never worked around.

## Verification bar

A shipment is done when all of these hold:

- `ship.mjs build` and `ship.mjs app` exit 0, the latter without `--accept` unless the change
  removes pages on purpose.
- `audit-frames.mjs` reports 0 escapes, 0 hits over 1px and 0 text overlaps on every plate the
  change touched (and on every plate after a cabinet refresh); `check-scenes.mjs` passes when
  a model or its viewer moved.
- Every photograph in `tmp/shots/<tag>/` has been read, light and dark; a layout or type
  change also has a before tag to set beside it, at the layout's seam widths.
- `ship.mjs deploy` exits 0, its check passed, and prints a `*.altitude-atlas.pages.dev` URL.
- `ship.mjs verify --page <path> --marker <text>` exits 0 for the change's own marker.
- The Artifact publish result names a new version at the same URL.
- HISTORY.md carries the dated line (and the REV subhead when the letter moved); the hub line
  is written.
