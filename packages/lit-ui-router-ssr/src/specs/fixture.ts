// The one router and the one template set both halves of the seam render.
import { LitElementRenderer } from '@lit-labs/ssr/lib/lit-element-renderer.js';
import { html, LitElement } from 'lit';
import type { TemplateResult } from 'lit';
import { UIRouterLit } from 'lit-ui-router/pure';
import type {
  LitStateDeclaration,
  RoutedLitTemplate,
  UIRouterLit as Router,
} from 'lit-ui-router/pure';
import { installServerLocation } from 'ui-router-server/location';
import { uiViewSlot } from '../client.js';
import 'lit-ui-router/register';

/** The routed shell: a heading, and the nested `<ui-view>` its children fill. */
export const ShellView: RoutedLitTemplate = (props) => html`
  <h1>shell ${String(props.resolves.greeting ?? '')}</h1>
  ${uiView()}
`;

/** A second leaf, so a spec can route one view while the document was drawn for the other. */
export const OtherView: RoutedLitTemplate = () =>
  html`<p class="other">other</p>`;

/** A routed view whose one node is a shadow-DOM element, so the reveal has to reach into its shadow root. */
export const BadgeView: RoutedLitTemplate = () =>
  html`<shadow-badge></shadow-badge>`;

/** A leaf view, drawn from a resolve so the spec can see the resolve arrive. */
export const DetailView: RoutedLitTemplate = (props) =>
  html`<p class="detail">${String(props.resolves.detail ?? '')}</p>`;

/** One `<ui-view>`, with the slot the renderer fills on the server. */
export const uiView = (name = ''): TemplateResult =>
  name
    ? html`<ui-view name=${name}>${uiViewSlot()}</ui-view>`
    : html`<ui-view>${uiViewSlot()}</ui-view>`;

/** A shadow-DOM element, the half `@lit-labs/ssr-client`'s own hydrate support arms. */
export class ShadowBadge extends LitElement {
  override render(): TemplateResult {
    return html`<span class="badge">badge</span>`;
  }
}

customElements.define('shadow-badge', ShadowBadge);

/** `LitElementRenderer`, narrowed to the badge so every other element renders as it does in the other lane. */
export class ShadowBadgeRenderer extends LitElementRenderer {
  static override matchesClass(ctor: typeof HTMLElement): boolean {
    return ctor === (ShadowBadge as unknown as typeof HTMLElement);
  }
}

/** A custom element with nothing bound to it: `@lit-labs/ssr` defers it and writes no marker that would wake it. */
export class PlainMark extends HTMLElement {}

customElements.define('plain-mark', PlainMark);

/** The root both sides render: one `<ui-router>` around one `<ui-view>`. */
export const rootTemplate = (router: Router): TemplateResult =>
  html`<ui-router .uiRouter=${router}>${uiView()}</ui-router>`;

/** The same root with a binding standing after the view in the same template. */
export const tailRootTemplate = (
  router: Router,
  tail: string,
): TemplateResult =>
  html`<ui-router .uiRouter=${router}
    >${uiView()}<span class="tail">${tail}</span></ui-router
  >`;

/** A root whose view carries authored fallback content and no slot for the server to fill. */
export const fallbackRootTemplate = (router: Router): TemplateResult =>
  html`<ui-router .uiRouter=${router}
    ><ui-view><p class="loading">loading</p></ui-view></ui-router
  >`;

/** A root with a bindingless custom element standing before the router. */
export const plainRootTemplate = (router: Router): TemplateResult =>
  html`<plain-mark></plain-mark
    ><ui-router .uiRouter=${router}>${uiView()}</ui-router>`;

/** The same root with one shadow-DOM element beside the view. */
export const badgeRootTemplate = (router: Router): TemplateResult =>
  html`<ui-router .uiRouter=${router}
    ><shadow-badge></shadow-badge>${uiView()}</ui-router
  >`;

/** Two states: `shell`, and `shell.detail` filling the nested view. */
export const makeRouter = (): Router => {
  const router = installServerLocation(new UIRouterLit(), {
    strictMode: false,
  });
  const states: LitStateDeclaration[] = [
    {
      name: 'shell',
      url: '/shell',
      component: ShellView,
      resolve: { greeting: () => 'hello' },
    },
    {
      name: 'shell.detail',
      url: '/detail',
      component: DetailView,
      resolve: { detail: () => 'leaf' },
    },
    {
      name: 'shell.other',
      url: '/other',
      component: OtherView,
    },
    { name: 'badge', url: '/badge', component: BadgeView },
    { name: 'bare', url: '/bare' },
  ];
  for (const state of states) router.stateRegistry.register(state);
  return router;
};

/** Settles `router` on `path`; `start()` syncs the first url itself. */
export const goTo = async (router: Router, path: string): Promise<void> => {
  const settled = new Promise<void>((resolve, reject) => {
    const offSuccess = router.transitionService.onSuccess({}, () => {
      offSuccess();
      offError();
      resolve();
    }) as () => void;
    const offError = router.transitionService.onError({}, (transition) => {
      offSuccess();
      offError();
      reject(new Error(String(transition.error())));
    }) as () => void;
  });
  router.urlService.url(path);
  if (!started.has(router)) {
    started.add(router);
    router.start();
  }
  await settled;
};

const started = new WeakSet<Router>();
