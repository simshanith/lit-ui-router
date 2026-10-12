---
name: atlas-ship
description: Ship a change to the Altitude Atlas (www/atlas.lit-ui-router.dev on branch www/atlas) — a sheet, the app, the generator or HISTORY.md — through build, audit, commit, push, stage, Pages deploy, live verify and the Artifact republish. Use whenever atlas work is ready to go up, and as the unattended checklist for a run with nobody watching.
---

# Ship the atlas

The order, the checks and the shell traps live in
[docs/SHIPPING.md](../../../docs/SHIPPING.md);
the build steps belong to the files it names. This skill adds only what an unattended run needs.

`<WT>` is the worktree holding `www/atlas`; `<A>` is `<WT>/www/atlas.lit-ui-router.dev`;
`<T>` is the job's `tmp/`. Every path below is absolute. One command per Bash call; every git
call is plain `git -C <WT> …`; output over a screen goes to `<T>/<step>.log` with the exit
code echoed, then grep.

1. `mise exec -- node www/atlas.lit-ui-router.dev/generator/build.mjs www/atlas.lit-ui-router.dev`
   from `<WT>`. Non-zero exit: stop.
2. `mise exec -- npm --prefix <A>/app run typecheck`, then `… run build`. Read the
   `prerendered N pages` and `scoped router at construction: N/N` lines; a count below the
   last shipment's: stop.
3. `mise exec -- node <A>/generator/audit-frames.mjs <tag> --only <ids>` and
   `mise exec -- node <A>/generator/shoot.mjs <tag> --only <ids>` from `<WT>`. Any audit
   count above the previous tag's: stop. Read every PNG under `<A>/tmp/shots/<tag>/`, light
   and dark, before step 4. A model change also runs `<A>/generator/check-scenes.mjs <A>`.
4. Add the HISTORY.md line (and REV subhead when the letter moves). Write the commit message
   to `<T>/msg.txt` with the Write tool: lowercase conventional subject, body ≤100 chars a
   line, blank line, `Claude-Session: <url>`. `git -C <WT> add <paths>`, then
   `git -C <WT> commit -F <T>/msg.txt`. A hook failure: fix the file, never bypass the hook.
5. `git -C <WT> push origin www/atlas`. The `Bypassed rule violations` notice is normal;
   `git -C <WT> ls-remote origin www/atlas` must show HEAD.
6. `cd <A> && mise exec -- node generator/stage-site.mjs`. `Adobe Fonts kit: none`: stop.
7. `cd <A> && grep -c typekit dist/city/index.html` ≥ 1 and
   `cd <A> && grep -c fonts.googleapis dist/city/index.html` = 0. Otherwise: stop.
8. In its own call, nothing paired: `cd <A> && mise exec -- pnpm exec wrangler pages deploy dist --project-name altitude-atlas --branch www/atlas --commit-dirty=true`.
   A classifier denial is reported, not routed around.
9. `curl -sL https://atlas.lit-ui-router.dev/<page>/ | grep -c <marker>` twice, plus the
   `typekit` count. A second fetch that disagrees with the expected marker: stop and report
   the deployment URL from the deploy log.
10. `mise exec -- npm --prefix <A>/app run build:artifact`, then publish `<A>/app/dist-artifact/index.html`
    with the Artifact tool, `url: https://claude.ai/artifact/JpLqLDXLwY8nwKByiLx5V4`, a label,
    no icon.
11. Append the shipment line to the memory hub.

Subagents stop at step 3 and report; the main session runs 4 to 11.

Report: the commit sha, the deployment URL, the Artifact version, the audit TOTAL line, the
two build counts, and any stop with the log path that shows it.
