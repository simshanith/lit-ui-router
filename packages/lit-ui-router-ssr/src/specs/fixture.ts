// The one router and the one template set both halves of the seam render.
import { renderLight } from '@lit-labs/ssr-client/directives/render-light.js';
import { html } from 'lit';
import type { TemplateResult } from 'lit';
import { UIRouterLit } from 'lit-ui-router/pure';
import type {
  LitStateDeclaration,
  RoutedLitTemplate,
  UIRouterLit as Router,
} from 'lit-ui-router/pure';
import { installServerLocation } from 'ui-router-server/location';

/** The routed shell: a heading, and the nested `<ui-view>` its children fill. */
export const ShellView: RoutedLitTemplate = (props) => html`
  <h1>shell ${String(props.resolves.greeting ?? '')}</h1>
  ${uiViewSlot()}
`;

/** A leaf view, drawn from a resolve so the spec can see the resolve arrive. */
export const DetailView: RoutedLitTemplate = (props) =>
  html`<p class="detail">${String(props.resolves.detail ?? '')}</p>`;

/**
 * The hole a `<ui-view>` fills. `renderLight()` is the use site's opt-in to an
 * element renderer's light-DOM render; on the client it commits nothing and the
 * element hydrates against the markers the part left behind.
 */
export const uiViewSlot = (name = ''): TemplateResult =>
  name
    ? html`<ui-view name=${name}>${renderLight()}</ui-view>`
    : html`<ui-view>${renderLight()}</ui-view>`;

/** The root both sides render: one `<ui-router>` around one `<ui-view>`. */
export const rootTemplate = (router: Router): TemplateResult =>
  html`<ui-router .uiRouter=${router}>${uiViewSlot()}</ui-router>`;

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
