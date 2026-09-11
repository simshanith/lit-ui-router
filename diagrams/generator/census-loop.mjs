// Sheet 1i's census: the RENDER LOOP of lit-ui-router — sheet 1's circuit —
// read off the ARCHIVE as a T1 tree probe (INITIATIVES.md I5 pattern;
// census-couplings.mjs is the exemplar).  Nothing is executed: every figure
// here is a text read of six files under packages/lit-ui-router/src/.
//
// Vocabulary:
//   station  — one building on sheet 1 (location, core, the hall, a view, …),
//              anchored to the line where lit-ui-router implements it;
//   leg      — one arrow on sheet 1: `loop` legs are the render cycle, `click`
//              is the uiSref click flying back into core, `event` legs are the
//              composed DOM events stations find each other by, `tap` legs are
//              the transition hooks overlays register without standing on the
//              route.  Each carries the call or event that moves it;
//   walk     — ONE navigation, a click on `<a uiSref>` from /people to
//              /people/32, as an ordered list of steps.  Each step names the
//              leg(s) it lights, narrates one sentence, and files 1–3 evidence
//              entries {file, line, text} — the VERBATIM source at that line.
//
// The evidence table below is authored as (file, line, expect): the probe
// reads the archive at that line and THROWS if `expect` is not on it, so a
// line number that rots after a refactor breaks the probe rather than
// silently filing the wrong sentence.  Core's own sequence (transition
// created → onBefore → onStart → resolves → views → onSuccess → url) is
// stated only through the hooks lit-ui-router registers; no core line is cited.
// The default ref is the CABINET's pin (the master plate's sha), not a live
// branch tip — a probe filed later must measure the tree its siblings measured.
// `--tree <dir>` hands in an already-materialized archive of that same sha for
// a sandbox that cannot run git; provenance still comes from the cabinet.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { materialize, refFromArgv } from './basis.mjs';
import { loadCensus, provenance, writeData } from './census-query.mjs';

const argv = process.argv.slice(2);
const argRef = argv.includes('--ref') ? refFromArgv(argv) : null;
const treeAt = argv.indexOf('--tree');
const tree = treeAt !== -1 ? argv[treeAt + 1] : null;
const snap = loadCensus();
const basis = tree
  ? { ref: snap.ref, sha: snap.sha, commitDate: snap.commitDate, dir: tree, cleanup: () => {} }
  : materialize(argRef ?? snap.sha);

const SRC = 'packages/lit-ui-router/src';
const cache = new Map();
const linesOf = (file) => {
  if (!cache.has(file)) cache.set(file, readFileSync(join(basis.dir, SRC, file), 'utf8').split('\n'));
  return cache.get(file);
};

// {file, line, expect, span?} -> {file, line, text}: the line must carry
// `expect`, and `text` is the verbatim source over `span` (≤ 3) lines.
const cite = ({ file, line, expect, span = 1 }) => {
  if (span > 3) throw new Error(`census-loop: ${file}:${line} spans ${span} lines — 3 is the cap`);
  const src = linesOf(file);
  const at = src[line - 1];
  if (at === undefined) throw new Error(`census-loop: ${file} has no line ${line}`);
  if (!at.includes(expect)) throw new Error(`census-loop: ${file}:${line} does not read «${expect}» — it reads «${at.trim()}»`);
  const text = src.slice(line - 1, line - 1 + span).map((l) => l.replace(/^\s+/, '')).join('\n');
  return { file: `${SRC}/${file}`, line, text };
};

try {
  // ---- a) the stations: sheet 1's buildings, each with its anchor line ----
  const STATIONS = [
    { id: 'location', label: 'LOCATION', sub: 'history · hash · Navigation API', file: 'core.ts', line: 268, expect: 'this.urlService.listen();' },
    { id: 'core', label: '@uirouter/core', sub: 'state registry · match · go()', file: 'core.ts', line: 226, expect: 'export class UIRouterLit extends UIRouter {' },
    { id: 'hall', label: 'TRANSITION HALL', sub: 'onBefore | onStart · resolve | onSuccess', file: 'ui-view.ts', line: 236, expect: 'router.transitionService.onBefore({}, (trans) => {' },
    { id: 'view', label: '<ui-view>', sub: 'the viewport', file: 'ui-view.ts', line: 74, expect: 'export class UiView extends LitElement {' },
    { id: 'child', label: "<ui-view name='detail'>", sub: 'nested — stands on its parent', file: 'ui-view.ts', line: 182, expect: 'static seekParentView(candidate: Element): UiView | null {' },
    { id: 'render', label: 'LIT RENDER', sub: 'RoutedLitTemplate · html``', file: 'ui-view.ts', line: 386, expect: 'render(): Node | TemplateResult {' },
    { id: 'document', label: 'THE DOCUMENT', sub: 'window → body → <ui-router> → …', file: 'ui-router.ts', line: 32, expect: 'export class UIRouterLitElement extends LitElement {' },
    { id: 'link', label: '<a uiSref>', sub: 'the topmost plate', file: 'ui-sref.ts', line: 180, expect: 'export class UiSrefDirective extends AsyncDirective {' },
    { id: 'active', label: 'uiSrefActive', sub: 'perch — toggles .active below', file: 'ui-sref-active.ts', line: 269, expect: 'export class UiSrefActiveDirective extends AsyncDirective {' },
    { id: 'controller', label: 'TransitionController', sub: 'ReactiveController skybridge', file: 'transition-controller.ts', line: 148, expect: 'export class TransitionController implements ReactiveController {' },
  ].map(({ id, label, sub, ...ev }) => ({ id, label, sub, ...cite(ev) }));

  // ---- b) the legs: sheet 1's arrows, each with the call or event that moves it
  const LEGS = [
    { id: 'sync', from: 'location', to: 'core', kind: 'loop', carrier: 'urlService.listen() · sync()', short: 'popstate / navigate',
      ev: { file: 'core.ts', line: 268, expect: 'this.urlService.listen();', span: 2 } },
    { id: 'run', from: 'core', to: 'hall', kind: 'loop', carrier: 'transitionService.onBefore / onStart / onSuccess', short: 'match → run',
      ev: { file: 'ui-view.ts', line: 236, expect: 'router.transitionService.onBefore({}, (trans) => {' } },
    { id: 'activate', from: 'hall', to: 'view', kind: 'loop', carrier: 'viewService.registerUIView → configUpdated', short: 'viewconfigs activate',
      ev: { file: 'ui-view.ts', line: 248, expect: 'router.viewService.registerUIView(this._uiViewData),' } },
    { id: 'descend', from: 'view', to: 'child', kind: 'loop', carrier: 'fqn = parentFqn + "." + name', short: 'one level down',
      ev: { file: 'ui-view.ts', line: 219, expect: "const fqn = parentFqn ? parentFqn + '.' + name : name;" } },
    { id: 'render', from: 'view', to: 'render', kind: 'loop', carrier: 'requestUpdate() → render() → component({ router, resolves, transition })', short: 'state.component / template',
      ev: { file: 'ui-view.ts', line: 404, expect: 'const props: UIViewInjectedProps = { router, resolves, transition };', span: 3 } },
    { id: 'commit', from: 'render', to: 'document', kind: 'loop', carrier: 'createRenderRoot(): this — the template lands in the light DOM', short: 'directives commit',
      ev: { file: 'ui-view.ts', line: 95, expect: 'createRenderRoot(): this {', span: 3 } },
    { id: 'click', from: 'link', to: 'core', kind: 'click', carrier: '$state.go(state, params, options)', short: 'click → go()',
      ev: { file: 'ui-sref.ts', line: 377, expect: 'void $state.go(state, params, options);', span: 2 } },
    { id: 'ctx', from: 'view', to: 'document', kind: 'event', carrier: 'ui-router-context (composed) — the shell answers with its router', short: 'ui-router-context',
      ev: { file: 'ui-router.ts', line: 71, expect: 'candidate.dispatchEvent(uiRouterContextEvent);', span: 2 } },
    { id: 'nest', from: 'child', to: 'view', kind: 'event', carrier: 'ui-view-context (composed) — the parent adopts', short: 'ui-view-context',
      ev: { file: 'ui-view.ts', line: 184, expect: 'candidate.dispatchEvent(uiViewContextEvent);', span: 2 } },
    { id: 'target', from: 'link', to: 'active', kind: 'event', carrier: 'uiSrefTarget (bubbles, composed)', short: 'uiSrefTarget bubbles',
      ev: { file: 'ui-sref.ts', line: 273, expect: 'this.element.dispatchEvent(uiSrefTargetEvent(this.targetState));' } },
    { id: 'tap-active', from: 'hall', to: 'active', kind: 'tap', carrier: 'transitionService.onStart({}, onTransitionStart) → transitionStateChange', short: 'onStart tap',
      ev: { file: 'ui-sref-active.ts', line: 606, expect: 'this._deregisterOnStart = this.uiRouter.transitionService.onStart(', span: 3 } },
    { id: 'tap-controller', from: 'hall', to: 'controller', kind: 'tap', carrier: "transitionService[event](criteria, …) — default ['onSuccess']", short: 'hook tap',
      ev: { file: 'transition-controller.ts', line: 227, expect: 'router.transitionService[event](', span: 3 } },
  ].map(({ ev, ...leg }) => ({ ...leg, ...cite(ev) }));

  // ---- c) the walk: one click, /people → /people/32, in the order the source runs it
  const WALK = [
    { title: 'AT REST — /people', legs: ['ctx', 'nest', 'target'],
      text: 'Before the click nothing is routed by lookup: at connect each <ui-view> found its router with a composed ui-router-context event, the nested view found its parent with ui-view-context, and every uiSref announced its targetState upward to the uiSrefActive perch.',
      ev: [{ file: 'ui-view.ts', line: 197, expect: 'this.uiRouter = this.uiRouter || UIRouterLitElement.seekRouter(this);' },
        { file: 'ui-view.ts', line: 189, expect: 'this.parentView = this.constructor.seekParentView(this)!;' },
        { file: 'ui-sref-active.ts', line: 664, expect: 'this.targetStates.add(targetState);', span: 2 }] },
    { title: 'THE CLICK', legs: ['click'],
      text: "The link's click handler lets modified clicks and off-app hrefs fall through to the browser, then hands the target to core — $state.go, fire-and-forget — and only afterwards cancels the native navigation.",
      ev: [{ file: 'ui-sref.ts', line: 348, expect: 'onClick = (event: MouseEvent): void => {' },
        { file: 'ui-sref.ts', line: 369, expect: 'isNativeLink(element) &&', span: 3 },
        { file: 'ui-sref.ts', line: 377, expect: 'void $state.go(state, params, options);', span: 2 }] },
    { title: 'onBefore — CAN WE LEAVE?', legs: ['run'],
      text: 'Core builds the transition and runs its onBefore bay; <ui-view> is waiting there for every transition, and if its routed component declares uiCanExit and the state is being exited, it hooks that function onto this one transition\'s onStart.',
      ev: [{ file: 'ui-view.ts', line: 236, expect: 'router.transitionService.onBefore({}, (trans) => {', span: 3 },
        { file: 'ui-view.ts', line: 280, expect: 'if (trans.exiting().includes(state)) {', span: 3 }] },
    { title: 'onStart — THE PERCH HEARS IT', legs: ['run', 'tap-active'],
      text: 'The onStart bay fires uiSrefActive\'s tap: the perch turns the transition into a transitionStateChange "start" event on its own element, recomputes entering / exiting against every target it collected, and re-renders its classes.',
      ev: [{ file: 'ui-sref-active.ts', line: 697, expect: 'onTransitionStart = (trans: Transition): void => {', span: 3 },
        { file: 'ui-sref-active.ts', line: 675, expect: 'const { active, exact, entering, exiting } = status;', span: 3 }] },
    { title: 'RESOLVE', legs: ['run'],
      text: 'Core resolves the destination\'s resolvables in the hall; lit-ui-router adds none of its own here, and will read the resolved ones later off the view\'s ResolveContext — only the tokens that are strings and only those already resolved.',
      ev: [{ file: 'ui-view.ts', line: 393, expect: 'const resolvables = this.resolveContext', span: 3 },
        { file: 'ui-view.ts', line: 397, expect: '.filter((r) => r.resolved);' }] },
    { title: 'VIEWS ACTIVATE', legs: ['activate'],
      text: 'The view service syncs: the LitViewConfig the factory registered at construction reaches the parent <ui-view> through the configUpdated callback it registered with, and _applyUpdatedConfig swaps in a new ResolveContext and the state\'s component before asking Lit for an update.',
      ev: [{ file: 'core.ts', line: 239, expect: "this.viewService._pluginapi._viewConfigFactory('lit', viewConfigFactory);" },
        { file: 'ui-view.ts', line: 227, expect: 'configUpdated: this._viewConfigUpdated.bind(this),' },
        { file: 'ui-view.ts', line: 135, expect: 'this.resolveContext = new ResolveContext(config.path);', span: 3 }] },
    { title: 'ONE LEVEL DOWN', legs: ['descend'],
      text: 'The nested <ui-view name="detail"> is the same station one storey up: it registered under its parent\'s fqn plus its own name, so people.detail\'s config lands on it by the same callback, with the same swap.',
      ev: [{ file: 'ui-view.ts', line: 219, expect: "const fqn = parentFqn ? parentFqn + '.' + name : name;" },
        { file: 'ui-view.ts', line: 248, expect: 'router.viewService.registerUIView(this._uiViewData),' }] },
    { title: 'LIT RENDER', legs: ['render'],
      text: 'requestUpdate is overridden to poke the routed child too; then render() builds the injector, reduces the resolved tokens into a resolves object, fetches the Transition, and calls the state\'s component with { router, resolves, transition }.',
      ev: [{ file: 'ui-view.ts', line: 289, expect: 'requestUpdate(...args: Parameters<LitElement[\'requestUpdate\']>): void {', span: 3 },
        { file: 'ui-view.ts', line: 399, expect: 'const resolves = resolvables', span: 3 },
        { file: 'ui-view.ts', line: 404, expect: 'const props: UIViewInjectedProps = { router, resolves, transition };', span: 3 }] },
    { title: 'THE DOCUMENT', legs: ['commit', 'target'],
      text: 'The template commits into the light DOM — <ui-view> renders into itself — and every uiSref in it re-runs: update() re-reads its arguments, render() writes the href core computes, and a link whose target changed announces it upward again.',
      ev: [{ file: 'ui-view.ts', line: 95, expect: 'createRenderRoot(): this {', span: 3 },
        { file: 'ui-sref.ts', line: 257, expect: "this.element.setAttribute('href', this.href);" },
        { file: 'ui-sref.ts', line: 272, expect: 'if (targetChanged) {', span: 2 }] },
    { title: 'onSuccess — THE VIEW HEARS IT', legs: ['run', 'activate'],
      text: 'The onSuccess bay fires <ui-view>\'s second hook: it requests one more update, then diffs the to and from param schemas and, if any param changed or is new, calls the component\'s uiOnParamsChanged with just those values.',
      ev: [{ file: 'ui-view.ts', line: 242, expect: 'router.transitionService.onSuccess({}, (trans) =>', span: 2 },
        { file: 'ui-view.ts', line: 300, expect: 'private _invokeUiOnParamsChangedHook($transition$: Transition) {', span: 2 },
        { file: 'ui-view.ts', line: 353, expect: 'instance.uiOnParamsChanged(newValues, $transition$);' }] },
    { title: 'THE PERCH AND THE SKYBRIDGE', legs: ['tap-active', 'tap-controller'],
      text: 'The same success reaches the two overlays: uiSrefActive\'s trans.promise settles and its "success" event toggles the active / exact classes on the element, and TransitionController\'s onSuccess hook notifies its callback and calls host.requestUpdate — neither ever stood on the route.',
      ev: [{ file: 'ui-sref-active.ts', line: 701, expect: 'trans.promise.then(', span: 3 },
        { file: 'ui-sref-active.ts', line: 347, expect: 'this.element!.classList.add(className);' },
        { file: 'transition-controller.ts', line: 255, expect: 'this.host.requestUpdate();' }] },
    { title: 'THE URL — THE LOOP CLOSES', legs: ['sync'],
      text: 'Core writes /people/32 to location with its own url hook — lit-ui-router registers nothing for that leg. What it does own is the wire in the other direction: listen() and sync() at start(), which is how a back button will carry this same walk into core next time.',
      ev: [{ file: 'core.ts', line: 267, expect: 'this.urlMatcherFactory.$get();', span: 3 }] },
  ].map((s, i) => ({ step: i + 1, title: s.title, legs: s.legs, text: s.text, evidence: s.ev.map(cite) }));

  // ---- d) the plate must agree with itself before it is filed ------------
  const sid = new Set(STATIONS.map((s) => s.id));
  const lid = new Set(LEGS.map((l) => l.id));
  for (const l of LEGS) {
    if (!sid.has(l.from) || !sid.has(l.to)) throw new Error(`census-loop: leg ${l.id} joins ${l.from} → ${l.to}, and one of those is not a station`);
  }
  const lit = new Set();
  for (const s of WALK) {
    if (!s.legs.length || s.legs.length > 3) throw new Error(`census-loop: step ${s.step} lights ${s.legs.length} legs — 1 to 3`);
    if (!s.evidence.length || s.evidence.length > 3) throw new Error(`census-loop: step ${s.step} files ${s.evidence.length} evidence entries — 1 to 3`);
    for (const l of s.legs) {
      if (!lid.has(l)) throw new Error(`census-loop: step ${s.step} lights ${l}, which is not a leg`);
      lit.add(l);
    }
  }
  const unlit = LEGS.filter((l) => !lit.has(l.id)).map((l) => l.id);
  if (unlit.length) throw new Error(`census-loop: the walk never lights ${unlit.join(', ')}`);

  const KINDS = ['loop', 'click', 'event', 'tap'];
  const plate = {
    ...provenance(snap, 'diagrams/generator/census-loop.mjs', ['git']),
    used: `git archive ${argRef ?? snap.ref} @ ${basis.sha} — ${SRC}/{${[...cache.keys()].sort().join(',')}} read line by line; every evidence line checked against its expected text`,
    walkOf: 'a click on <a uiSref> from /people to /people/32',
    totals: {
      stations: STATIONS.length,
      legs: LEGS.length,
      steps: WALK.length,
      evidence: WALK.reduce((a, s) => a + s.evidence.length, 0),
      files: cache.size,
      byKind: Object.fromEntries(KINDS.map((k) => [k, LEGS.filter((l) => l.kind === k).length])),
    },
    stations: STATIONS,
    legs: LEGS,
    walk: WALK,
  };
  writeData('census-loop.json', plate, ['stations', 'legs', 'walk']);

  console.log(`census-loop.json: ${plate.ref} @ ${basis.sha}`);
  for (const s of STATIONS) console.log(' ', s.id.padEnd(11), `${s.file}:${s.line}`.padEnd(46), s.label);
  for (const l of LEGS) console.log(' ', `${l.from} -> ${l.to}`.padEnd(24), l.kind.padEnd(6), `${l.file}:${l.line}`);
  for (const s of WALK) console.log(' ', String(s.step).padStart(2), s.title.padEnd(34), s.legs.join(' '), '·', s.evidence.map((e) => `${e.file.slice(SRC.length + 1)}:${e.line}`).join(' '));
  console.log(`${plate.totals.stations} stations · ${plate.totals.legs} legs · ${plate.totals.steps} steps · ${plate.totals.evidence} evidence lines`);
} finally {
  basis.cleanup();
}
