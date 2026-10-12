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

Each step is one Bash call. Long output goes to a file under the job's `tmp/`, exit code
echoed, then searched; nothing is piped to `head` or `tail`.

1. **Generator build**, from `<WT>`:
   `node www/atlas.lit-ui-router.dev/generator/build.mjs www/atlas.lit-ui-router.dev`.
   Writes the flat set, the fragments, the models and the manifest ([README.md](../README.md),
   "Build and host"). A new plate needs the picture pass first (build → app build →
   `thumbs.mjs` → build → app build; `build.mjs` refuses a manifest whose card has no picture).
2. **App build**, absolute prefix:
   `mise exec -- npm --prefix <WT>/www/atlas.lit-ui-router.dev/app run typecheck`, then `… run build`.
   The build log carries two lines to read: `prerendered N pages + 1 × 404.html · M redirects`
   and `scoped router at construction: N/N renders match router.globals`. A count below the
   previous shipment's is a stop.
3. **Frame audit and photographs**, from `<WT>`:
   `mise exec -- node www/atlas.lit-ui-router.dev/generator/audit-frames.mjs <tag> [--only ids]`
   and `… generator/shoot.mjs <tag> [--only ids]`. The audit exits 1 on an escape, a hit deeper
   than 1px or text over text; its TOTAL line is compared against the last tag's. `shoot.mjs`
   writes light and dark PNGs under `tmp/shots/<tag>/`; read every picture with the Read tool,
   both themes, before going on. A 3D plate change also runs `generator/check-scenes.mjs`.
4. **Commit**, message in a file, plain git:
   `git -C <WT> commit -F <tmp>/msg.txt`. The husky `commit-msg` hook runs commitlint
   ([CONTRIBUTING.md](../../../docs/CONTRIBUTING.md#commit-conventions), rules in
   `.commitlintrc.ts`): a lowercase conventional subject such as `feat(atlas): sheet 5 rev c, …`;
   body lines of 100 characters or fewer; no body line opening with `word:` (commitlint reads
   it as a footer); a blank line before the trailer `Claude-Session: <session url>`. A
   `footer-leading-blank` warning means the blank line is missing; fix the file rather than
   accept it.
5. **Push**: `git -C <WT> push origin www/atlas`. The remote prints
   `remote: Bypassed rule violations for refs/heads/www/atlas: - Cannot update this protected ref.`
   on every push; that is the admin bypass reporting itself and the push succeeds. Confirm with
   `git -C <WT> ls-remote origin www/atlas` against `git -C <WT> rev-parse HEAD`.
6. **Stage**, cwd = the atlas dir: `mise exec -- node generator/stage-site.mjs`.
   `mise exec` supplies `VITE_ADOBE_FONTS_KIT` and `VITE_GOOGLE_ANALYTICS_TRACKING_ID` from the
   gitignored `.config/mise/cloudflare.local.env`; the log line `Adobe Fonts kit: <id>` is the
   check, and `Adobe Fonts kit: none` is a stop. A fork worktree has no such file and never
   deploys ([generator/stage-site.mjs](../generator/stage-site.mjs) header).
7. **Pre-deploy check**, in the atlas dir: `grep -c typekit dist/city/index.html` is 1 or more
   and `grep -c fonts.googleapis dist/city/index.html` is 0. `dist/` here is the staged site;
   `app/dist` one level down is the raw vite build with Google font links and no GA tag.
8. **Deploy**, alone in its own Bash call, cwd = the atlas dir:
   `mise exec -- pnpm exec wrangler pages deploy dist --project-name altitude-atlas --branch www/atlas --commit-dirty=true`.
   That exact string is the allow-listed command in the main checkout's
   `.claude/settings.local.json`; any variation asks. "Deployment complete" names the upload,
   not the tree, which is why step 7 exists. Only the main session deploys; a subagent's deploy
   is refused.
9. **Live verify**, twice: `curl -sL https://atlas.lit-ui-router.dev/<page>/ | grep -c <marker>`
   for the change's own marker and for `typekit`, plus
   `curl -sL -o /dev/null -w '%{http_code} %{url_effective}'` on `/`, `/sheet/7/`, `/sheet/2a`
   (302 to `/sheet/2A`), `/set/` and `/sheet/99` (404). The first fetch after a deploy can
   still read the previous deploy; a second fetch that agrees is the verdict, and the
   deployment's own `*.altitude-atlas.pages.dev` URL answers at once.
10. **Artifact**: `npm --prefix <WT>/www/atlas.lit-ui-router.dev/app run build:artifact`, then
    publish `app/dist-artifact/index.html` with the Artifact tool by `url`
    (`https://claude.ai/artifact/JpLqLDXLwY8nwKByiLx5V4`), a short `label`, no icon. The
    artifact build keeps the Google font links by design ([app/README.md](../app/README.md),
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
- **The shell's cwd drifts** between calls and after environment updates. `--prefix` takes an
  absolute path; `cd <atlas dir> && …` prefixes the stage and the checks; the deploy stands
  alone in its call.
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
- **The classifier.** The deploy and the Artifact upload carry standing authorization; a
  denial is reported to the user, never worked around.

## Verification bar

A shipment is done when all of these hold:

- `build.mjs` and the app build exit 0; the `prerendered` and `scoped router` counts are at or
  above the last shipment's.
- `audit-frames.mjs` reports 0 escapes, 0 hits over 1px and 0 text overlaps on every plate the
  change touched (and on the whole set after a cabinet refresh); `check-scenes.mjs` passes when
  a model or its viewer moved.
- Every photograph in `tmp/shots/<tag>/` has been read, light and dark; a layout or type
  change also has a before tag to set beside it, at the layout's seam widths.
- `dist/city/index.html` carries `typekit` and no `fonts.googleapis`.
- `git ls-remote` shows the pushed sha; the deploy log ends in a `*.altitude-atlas.pages.dev`
  URL; two live fetches agree on the change's marker and on `typekit`.
- The Artifact publish result names a new version at the same URL.
- HISTORY.md carries the dated line (and the REV subhead when the letter moved); the hub line
  is written.
