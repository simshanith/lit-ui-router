import type {
  StateDeclaration,
  Transition,
  TransitionService,
} from '@uirouter/core';

export const APP_TITLE = 'UI-Router Lit sample app';

/** A state's `data.title`: fixed, or read from the transition's resolves. */
export type RouteTitle = string | ((transition: Transition) => string);

const isTitleResolver = (
  title: RouteTitle | undefined,
): title is (transition: Transition) => string => typeof title === 'function';

/** The top-level state under `app`: `contacts.contact.edit` is `contacts`. */
const sectionOf = (state: StateDeclaration) => state.name?.split('.')[0] ?? '';

interface TitleData {
  title?: RouteTitle;
  /** Replaces `title` in analytics where `title` reads record content. */
  analyticsTitle?: string;
}

// SAFETY: StateDeclaration.data is `any`; the state declarations set `title` only as a RouteTitle and `analyticsTitle` only as a string
const titleDataOf = (transition: Transition) =>
  (transition.to().data ?? {}) as TitleData;

const withAppTitle = (text: string | undefined) =>
  text ? `${text} — ${APP_TITLE}` : APP_TITLE;

function titleOf(transition: Transition) {
  const { title } = titleDataOf(transition);

  return withAppTitle(isTitleResolver(title) ? title(transition) : title);
}

/** The `page_title` analytics receives: never a message subject or contact name. */
export function analyticsTitleOf(transition: Transition) {
  const { analyticsTitle } = titleDataOf(transition);

  return analyticsTitle ? withAppTitle(analyticsTitle) : titleOf(transition);
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
    { priority: 10 },
  );
}
