import type {
  StateDeclaration,
  Transition,
  TransitionService,
} from '@uirouter/core';

export const APP_TITLE = 'UI-Router Lit sample app';

/** A state's `data.title`: fixed, or read from the transition's resolves. */
export type RouteTitle = string | ((transition: Transition) => string);

/** The top-level state under `app`: `contacts.contact.edit` is `contacts`. */
const sectionOf = (state: StateDeclaration) => state.name?.split('.')[0] ?? '';

function titleOf(transition: Transition) {
  // StateDeclaration.data is `any`; titles are set in the state declarations.
  const title = (transition.to().data as { title?: RouteTitle } | undefined)
    ?.title;
  const text = typeof title === 'function' ? title(transition) : title;
  return text ? `${text} — ${APP_TITLE}` : APP_TITLE;
}

/** Sticky sections stay rendered under `display: none`, so skip hidden ones. */
const visible = (element: Element | null) =>
  !!element?.isConnected && element.checkVisibility();

function focusLost() {
  const active = document.activeElement;
  return !active || active === document.body || !visible(active);
}

function focusViewHeading() {
  const heading = [...document.querySelectorAll<HTMLElement>('main h1')].find(
    visible,
  );
  heading?.focus();
}

/**
 * Sets `document.title` after each successful transition, and focuses the
 * view's `h1` on a section change or when the focused control left the page.
 */
export default function routeFocusHook(transitionService: TransitionService) {
  transitionService.onSuccess(
    {},
    (transition) => {
      document.title = titleOf(transition);

      const from = transition.from();
      if (!from.name) return;
      const sectionChanged = sectionOf(from) !== sectionOf(transition.to());

      // ui-views render in microtasks after onSuccess; a task runs after them
      setTimeout(() => {
        const { globals } = transition.router;
        if (globals.successfulTransitions.peekTail() !== transition) return;
        if (sectionChanged || focusLost()) {
          focusViewHeading();
        }
      });
    },
    // ahead of the analytics hook, so a page_view reads the new title
    { priority: 10 },
  );
}
