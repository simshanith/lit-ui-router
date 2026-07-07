# stackblitz-verify

Verifies the `examples/*` projects boot, render, and route on
[StackBlitz](https://stackblitz.com/) (WebContainers) for a given branch.
Local `vite build` doesn't prove the shipped consumption path — StackBlitz
installing from each example's `package-lock.json` and booting vite dev
in-browser — so this drives it with Playwright and headless Chrome.

## Usage

```bash
pnpm verify <branch> [example ...]   # default: all examples
```

Example: `pnpm verify main hellogalaxy`

Per example it opens `stackblitz.com/github/simshanith/lit-ui-router/tree/<branch>/examples/<name>`,
waits out the WebContainer boot (up to 6 minutes: in-browser npm install +
vite dev), extracts the preview frame's shadow-DOM text, exercises
router navigation (list → detail → back; the galaxy astronaut route asserts
`model-viewer` reports `loaded`), captures console errors, and saves
screenshots to `./out/`. Exits non-zero if any example fails to render or
navigate.

## Requirements

- Network access and a system Chrome install. Playwright's bundled Chromium
  hangs at StackBlitz's import screen (its `wss://stackblitz.com/cable`
  handshake fails), so the script launches `channel: 'chrome'` by default;
  `--bundled` opts back into the bundled browser.
- Not part of any turbo pipeline on purpose — it's slow, networked, and
  verifies remote state, so run it manually after pushing a branch.
