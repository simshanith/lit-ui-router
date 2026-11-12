# ui-router-devtools

Devtools for any [UI-Router](https://ui-router.github.io) `@uirouter/core` router: a recorder of versioned, JSON-safe transition events, a Lit panel that shows the state tree and the transition log, and reporters for the browser's Performance panel and console.

The outline marks what a declaration says about a state: a box in place of the ring for `abstract`, a dot and arrow for `redirectTo` (drawn on the rail into a default child), a circled H for `dsr` or `deepStateRedirect` from `@uirouter/dsr`, and a box split by a dashed line for `sticky` from `@uirouter/sticky-states`. The inspector names each in words.

The Map tab draws the state tree two ways, chosen in the panel header and remembered per viewer: nested boxes, child states inside their parent, and a node-link tree. The nested layout packs for the panel's shape and steps down a fit ladder when the tree is too large; under 560px of width, or when nothing on the ladder fits, the tree shows. No edge is drawn at rest: selecting a transition draws its edge, and selecting a state draws the traffic it has seen. The rules are in [the nested Map](../../docs/visualizer-proposal/map.md).

`observedEdges` folds a recorded session into one edge per ordered pair of states, with its count and outcomes, for exporters as well as the Map.

The package is private and unpublished, so it is workspace-only for now. The design, the screenshots and the open decisions are in the [router visualizer proposal](../../docs/visualizer-proposal/README.md) and its [devtools scope](../../docs/visualizer-proposal/devtools.md).

## Entry points

| Subpath         | Contents                                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `.`             | `observe` (the adapter), `record` (a ring-buffered recorder), `fold`, `observedEdges`, `reasons` and the event schema types |
| `./define`      | Registers `<ui-router-devtools>`; set its `router` property                                                                 |
| `./plugin`      | `DevtoolsPlugin`, for `router.plugin(DevtoolsPlugin)`; it appends the element to `document.body`                            |
| `./performance` | `reportToPerformance(events \| recorder)`: User Timing track entries for the Performance panel                              |
| `./console`     | `reportToConsole(events \| recorder)`: one collapsed group per settled transition                                           |
| `./testing`     | `transitions(session \| recorder)`, a snapshot-stable log, and `settled(recorder)`                                          |

`lit` is a dependency and `@uirouter/core` the only peer. The adapter reads only public hooks, with two exceptions, each isolated in its own module: `options().source`, typed `@internal` in core, tells a URL sync from a `go()` (`src/source.ts`), and the opt-in `timeResolves` option wraps each transition's `resolveFn` copies to time resolves (`src/resolve-timing.ts`). `timeResolves` is off by default, because core has no resolve notification and the wrapper patches core objects.

```ts
import { UIRouter } from '@uirouter/core';
import { DevtoolsPlugin } from 'ui-router-devtools/plugin';
import { reportToPerformance } from 'ui-router-devtools/performance';

declare const router: UIRouter;

const { element } = router.plugin(DevtoolsPlugin, { timeResolves: true });
if (element.recorder) reportToPerformance(element.recorder);
```

## Demo

```sh
pnpm -C packages/ui-router-devtools dev --port 5391 --strictPort
```

Open `http://localhost:5391/?demo=1` to play a fixed sequence: a success, a param change, a redirect, a superseded transition, two ignored, an error, a URL change, `location: 'replace'`, `reload: true` and an invalid target. `?perf=1` and `?console=1` turn on the two reporters. The demo opts into `timeResolves`. `?stress=1` registers a 60-state tree instead, six levels deep with 20 top-level siblings and a 40-character segment, to exercise the nested Map's fit ladder.

The demo fakes what a real app would supply:

- States have no components; the page renders a stub line on success.
- Resolves are `setTimeout` stubs (40 to 200 ms). `galaxy.blackhole` (a rejecting resolve), `mission` (an abstract state) and `admin.**` (a lazy future state) exist only here.
- `galaxy.stars` declares `dsr` and `sticky` to show their marks; neither plugin is loaded, so the properties do nothing.
- Inspector subsections for hooks and views are not built.

Two scripts work against the running demo: `pnpm shots` writes the proposal screenshots into `docs/visualizer-proposal/screenshots/` and runs axe on the open panel (`--port`, `--out`, `--only <prefix>`, `--scale`), and `pnpm size` reports min and gzip sizes per entry with `lit` and `@uirouter/core` external.

## Known limits

- An app `onInvalid` handler registered after the devtools that rescues a target still leaves an `invalid` row: callbacks run in registration order and the adapter cannot see the outcome.
- RTL mirrors the rails, map edges and selection bar; Latin text inside rows is not bidi-isolated.
- The nested Map's inspector popover can cover a neighbouring box or an edge in the 336px dock; the maximised panel shows the inspector below the diagram.
- A nested box opens and closes from the keyboard. A pointer opens a collapsed box by selecting it and has no way to close an open one.
