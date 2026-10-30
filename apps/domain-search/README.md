# domain-search

A domain-search page whose input is focused and filled at the first frame the visitor sees, built
on `lit-ui-router` and `lit-ui-router-ssr`, with a harness that measures it beside
[vercel.com/domains](https://vercel.com/domains). The docs site serves it at
[`/domain-search`](https://lit-ui-router.dev/domain-search), with `noindex`. Issue #1698 holds the
design.

## How the page works

- **One static shell.** `scripts/prerender.ts` draws `/domain-search` once, with no query, through
  `lit-ui-router-ssr`'s `prerender`, into the `index.html` vite built. Every query is served that
  one document.
- **States** (`src/states.ts`). `search` (`url: '/domain-search?q'`) holds the input. Its `q` is
  dynamic, so typing never exits it and the input never unmounts. A `redirectTo` picks
  `search.idle` or `search.results` by whether `q` is present. `search.results` draws its list
  from a resolve on `q`, and `src/search.ts` answers it in the page: availability and price come
  from a hash of the name.
- **The input moves by CSS.** The parent view writes the active child in `data-view`, and
  `src/styles.css` moves the input from the hero to the bar on it. The input binds `value=` as an
  attribute, so text typed before the app adopts the page stays in the box.
- **The pre-paint script** (`src/pre-paint.ts`). The prerender writes it as a classic inline script
  right after the input, from a typed function inlined with `toString()`. It fills the input from
  `?q=`, or from the last search in `localStorage`, focuses it, sets `data-domain-search-query` on
  `<html>` when a query is present, so CSS shows the results skeleton, and copies typing into the
  url with `history.replaceState` until the app boots. `test/pre-paint.test.ts` runs the inlined
  text in a `node:vm` context that holds only the globals it reads.
- **Boot** (`src/main.ts`). `bootstrap()` adopts the shell, starting from the url the script kept in
  step. Text typed after the router started and before the input's listener attached is searched
  once the page is live.

Mobile is out of scope: there the keyboard needs a tap.

## Commands

```bash
pnpm --filter domain-search build   # vite build, then the prerender
pnpm --filter domain-search dev     # vite on :5180, cold-rendered (no prerender)
pnpm --filter domain-search test    # the pre-paint and search specs
```

## The harness

`harness/frame-zero.e2e.ts` runs in Playwright's Chrome with the CPU throttled 4x and DevTools'
Slow 4G profile (`harness/conditions.ts`), and checks:

1. **Frame 0:** at first contentful paint, the input is focused and filled from `?q=`. A
   `PerformanceObserver` on the `paint` entry records the page's state in the task after the paint.
2. **Skeleton:** the hero shows without `?q=`, and the results skeleton with it.
3. **Typed before boot:** with the app's scripts held back, typed text survives the boot and the
   url carries it.
4. **Time to the first useful keystroke:** navigation start to the typed query showing in results,
   with time to the focused input beside it, over `DOMAIN_SEARCH_RUNS` runs (3 by default).

The `measure-domain-search` bin runs it. The `domain-search` suite in
[`sample-app-lit-e2e`](../sample-app-lit-e2e/README.md) points it at the local docs worker. It runs
only when named, and no CI workflow names it yet:

```bash
mise run test_e2e domain-search
```

`pnpm --filter domain-search measure:vercel` runs the same checks, read-only, against
`vercel.com/domains`. It is a manual script and never runs in CI.

One check, that a boot at `?q=` moves the input to the bar, is marked `expectFailure`: `bootstrap`
keeps the drawn `data-view` when a boot differs from the drawn page in its query alone.
