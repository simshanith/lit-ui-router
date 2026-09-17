// Directive plumbing shared by the sref element parts, attribute parts and status controller.
import {
  anyTrueR,
  equals,
  extend,
  isNumber,
  Param,
  PathNode,
  PathUtils,
  Predicate,
  RawParams,
  StateObject,
  tail,
  TargetState,
  TransitionOptions,
  UIRouter,
  unnestR,
} from '@uirouter/core';

import type { SrefStatus, TransEvt } from './ui-sref-active.js';
import type { ParentView } from './events.js';

/**
 * Event name dispatched when a uiSref target state changes.
 * @internal
 */
export const UI_SREF_TARGET_EVENT = 'uiSrefTarget';

/**
 * Interface for elements that have been enhanced with uiSref.
 * @internal
 */
export interface UiSrefElement extends Element {
  /** The href attribute value for the link */
  href: string;
  /** The target state for the link */
  targetState: TargetState;
}

/**
 * Custom event dispatched when a uiSref target state changes.
 * Used internally by uiSrefActive to track which states are being linked to.
 * @internal
 */
export interface UiSrefTargetEvent extends CustomEvent<{
  targetState: TargetState;
}> {
  target: UiSrefElement;
}

/**
 * Create a uiSrefTarget event with the given target state.
 * @param targetState - The target state for the event
 * @returns A custom event with the target state in the detail
 * @internal
 */
export function uiSrefTargetEvent(targetState: TargetState): UiSrefTargetEvent {
  return new CustomEvent(UI_SREF_TARGET_EVENT, {
    bubbles: true,
    composed: true,
    detail: { targetState },
  }) as UiSrefTargetEvent;
}

/**
 * Event name dispatched when a link's part leaves the DOM, so an enclosing
 * container drops its target at once instead of on the next transition.
 * @internal
 */
export const UI_SREF_TARGET_REMOVED_EVENT = 'uiSrefTargetRemoved';

/**
 * @internal
 */
export function uiSrefTargetRemovedEvent(): Event {
  return new Event(UI_SREF_TARGET_REMOVED_EVENT, {
    bubbles: true,
    composed: true,
  });
}

/**
 * The link a composed sref event came from: past a nested shadow root
 * `target` is the host, not the link.
 * @internal
 */
export function srefEventLink(event: Event): Element {
  const origin = event.composedPath()[0];
  return origin instanceof Element ? origin : (event.target as Element);
}

/**
 * `@uirouter/core` types `equals` as `any` because it resolves to
 * `angular.equals || _equals` at load time. The implementation is a deep
 * structural compare (arrays, Date by `getTime`, RegExp by source, NaN).
 * @internal
 */
const paramsEqual = equals as (a: RawParams, b: RawParams) => boolean;

/**
 * Whether two target states resolve to the same definition with the same params.
 * @internal
 */
export function sameTarget(a: TargetState | null, b: TargetState): boolean {
  return (
    !!a && a.$state() === b.$state() && paramsEqual(a.params(), b.params())
  );
}

/**
 * Core's transition options as an sref sends them: relative to the enclosing
 * view's state, inheriting params, attributed to `sref`. Shared by the
 * element-part {@link uiSref} and the attribute-part `srefHref`.
 * @internal
 */
export function srefTransitionOptions(
  parentView: ParentView | null,
  opts: TransitionOptions = {},
): TransitionOptions {
  const defaultOpts: TransitionOptions = {
    relative: parentView?.viewContext?.name,
    inherit: true,
    source: 'sref',
  };
  return extend(defaultOpts, opts || {}) as TransitionOptions;
}

/**
 * Whether the element navigates on its own. `localName` is lowercase for HTML
 * and SVG alike, so SVG `<a>` needs no namespace check.
 *
 * **Tag-based on purpose.** This decides where an `href` may be written, and
 * `href` is a property of the tag, not of the role: `<div role="link" href="…">`
 * is inert noise. `uiSrefActive`'s `isLinkElement` asks the neighbouring
 * *role*-based question for `aria-current`, which `<div role="link">`
 * legitimately takes. The two overlap on `<a>`/`<area>` and nowhere else — do
 * not unify them.
 *
 * @internal
 */
export function isNativeLink(element: Element): boolean {
  const tag = element.localName;
  return tag === 'a' || tag === 'area';
}

/**
 * Whether the click asked the browser for something other than a plain
 * in-place navigation: a new tab/window, a download, or a non-primary button.
 * @internal
 */
function isModifiedClick(event: MouseEvent): boolean {
  const { button, ctrlKey, metaKey, shiftKey, altKey } = event;
  return (
    !isNumber(button) || !!button || ctrlKey || metaKey || shiftKey || altKey
  );
}

/**
 * Whether the element declares that its href leaves this browsing context: a
 * `target` other than `_self`, or a `rel` token list containing `external`.
 * @internal
 */
function opensOffApp(element: Element): boolean {
  const target = element.getAttribute('target');
  // browsing-context keywords are ASCII case-insensitive; a name we do not
  // recognise is a frame, which is equally not ours. untrimmed on purpose —
  // the browser does not trim either, so `" _blank"` really is a frame name
  if (target && target.toLowerCase() !== '_self') {
    return true;
  }
  // rel is a token list: `rel="external noopener"` is still external
  return (element.getAttribute('rel') ?? '').split(/\s+/).includes('external');
}

/**
 * Whether a click on an sref element is the browser's to handle, so the
 * directive must not navigate. Shared by the element-part {@link uiSref} and
 * the attribute-part `srefHref`, so both answer the same question the same way.
 *
 * Author signals (`preventDefault`, `download`) apply whatever the element is.
 * The modifier and off-app guards are scoped to links with an `href`: they hand
 * the click back to the browser, and without one it has nothing to act on.
 *
 * @internal
 */
export function clickBelongsToBrowser(
  event: MouseEvent,
  element: Element,
): boolean {
  if (event.defaultPrevented || element.hasAttribute('download')) {
    return true;
  }
  return (
    isNativeLink(element) &&
    element.hasAttribute('href') &&
    (isModifiedClick(event) || opensOffApp(element))
  );
}

/**
 * Returns a Predicate<PathNode[]>
 *
 * The predicate returns true when the target state (and param values)
 * match the (tail of) the path, and the path's param values
 *
 * @internal
 */
const pathMatches = (target: TargetState): Predicate<PathNode[]> => {
  if (!target.exists()) return () => false;
  const state: StateObject = target.$state();
  const targetParamVals = target.params();
  const targetPath: PathNode[] = PathUtils.buildPath(target);
  const paramSchema: Param[] = targetPath
    .map((node) => node.paramSchema)
    .reduce<Param[]>(unnestR, [])
    .filter((param: Param) =>
      Object.prototype.hasOwnProperty.call(targetParamVals, param.id),
    );
  return (path: PathNode[] = []) => {
    const tailNode = tail(path);
    if (!tailNode || tailNode.state !== state) return false;
    const paramValues = PathUtils.paramValues(path) as RawParams;
    return Param.equals(paramSchema, paramValues, targetParamVals);
  };
};

/**
 * Given basePath: [a, b], appendPath: [c, d]),
 * Expands the path to [c], [c, d]
 * Then appends each to [a,b,] and returns: [a, b, c], [a, b, c, d]
 *
 * @internal
 */
function spreadToSubPaths(
  basePath: PathNode[],
  appendPath: PathNode[],
): PathNode[][] {
  return appendPath.map((node) =>
    basePath.concat(
      PathUtils.subPath(appendPath, (n) => n!.state === node.state),
    ),
  );
}

/**
 * @internal
 */
export function mergeSrefStatus(
  left: SrefStatus,
  right: SrefStatus,
): SrefStatus {
  return {
    active: left.active || right.active,
    exact: left.exact || right.exact,
    entering: left.entering || right.entering,
    exiting: left.exiting || right.exiting,
    targetStates: [...left.targetStates, ...right.targetStates],
  };
}

/**
 * The {@link SrefStatus} of one target for a transition event — or, with no
 * event, against the router's current state. Shared by the element-part
 * {@link uiSrefActive}, the attribute-part `srefActiveClass` /
 * `srefAriaCurrent`, and `SrefStatusController`.
 *
 * @internal
 */
export function srefStatus(
  router: UIRouter,
  event: TransEvt | undefined,
  srefTarget: TargetState,
): SrefStatus {
  const pathMatchesTarget = pathMatches(srefTarget);
  const tc = event?.trans.treeChanges();

  const isStartEvent = event?.evt === 'start';
  const isSuccessEvent = event?.evt === 'success';
  const activePath: PathNode[] | undefined = isSuccessEvent ? tc?.to : tc?.from;

  const isActive = () =>
    activePath
      ? spreadToSubPaths([], activePath)
          .map(pathMatchesTarget)
          .reduce(anyTrueR, false)
      : router.stateService.includes(srefTarget.name(), srefTarget.params());

  const isExact = () =>
    activePath
      ? pathMatchesTarget(activePath)
      : router.stateService.is(srefTarget.name(), srefTarget.params());

  const isEntering = () =>
    spreadToSubPaths(tc!.retained, tc!.entering)
      .map(pathMatchesTarget)
      .reduce(anyTrueR, false);

  const isExiting = () =>
    spreadToSubPaths(tc!.retained, tc!.exiting)
      .map(pathMatchesTarget)
      .reduce(anyTrueR, false);

  return {
    active: isActive(),
    exact: isExact(),
    entering: isStartEvent ? isEntering() : false,
    exiting: isStartEvent ? isExiting() : false,
    targetStates: [srefTarget],
  };
}
