---
name: atlas-ship
description: Ship a change to the Altitude Atlas (www/atlas.lit-ui-router.dev on branch www/atlas) — a sheet, the app, the generator or HISTORY.md — through build, audit, commit, push, stage, Pages deploy, live verify and the Artifact republish. Use whenever atlas work is ready to go up, and as the unattended checklist for a run with nobody watching.
---

# Ship the atlas

The order, the checks and the shell traps live in
[docs/SHIPPING.md](../../../docs/SHIPPING.md); the checks themselves belong to
[generator/ship.mjs](../../../generator/ship.mjs). This skill adds only what an unattended run
needs.

`<WT>` is the worktree holding `www/atlas`; `<A>` is `<WT>/www/atlas.lit-ui-router.dev`;
`<T>` is the job's `tmp/`. `ship <step>` below stands for
`mise exec -- node www/atlas.lit-ui-router.dev/generator/ship.mjs <step>`, run from `<WT>`.
One command per Bash call; every git call is plain `git -C <WT> …`; output over a screen goes
to `<T>/<step>.log` with the exit code echoed, then grep. A non-zero exit from any `ship` step
is a stop: report its `STOP —` line and the log path.

1. `ship build`.
2. `ship app`. Pass `--accept` only when the change removes pages on purpose.
3. `ship audit <tag> --only <ids>`. Read every PNG under `<A>/tmp/shots/<tag>/`, light and
   dark, before step 4. A model change also runs `<A>/generator/check-scenes.mjs <A>`.
4. Add the HISTORY.md line (and the REV subhead when the letter moves). Write the commit
   message to `<T>/msg.txt` with the Write tool: lowercase conventional subject, body ≤100
   chars a line, blank line, `Claude-Session: <url>`. `git -C <WT> add <paths>`, then
   `git -C <WT> commit -F <T>/msg.txt`. A hook failure: fix the file, never bypass the hook.
5. `git -C <WT> push origin www/atlas`, plain. The `Bypassed rule violations` notice is normal.
6. `ship stage`.
7. `ship deploy`, alone in its call. It runs `check` first.
8. `ship verify --page <path> --marker <text>`. A first stop on the marker is rerun once.
9. `ship artifact`, then publish `<A>/app/dist-artifact/index.html` with the Artifact tool,
   `url: https://claude.ai/artifact/JpLqLDXLwY8nwKByiLx5V4`, a label, no icon.
10. Append the shipment line to the memory hub.

A ship-guard or classifier denial is reported to the user, never routed around. Subagents stop
after step 3 and report; the main session runs 4 to 10.

Report: the commit sha, the deployment URL, the Artifact version, the audit TOTAL line, the
`ship app` counts, and any stop with the log path that shows it.
