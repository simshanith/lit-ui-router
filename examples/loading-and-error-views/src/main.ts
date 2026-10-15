import {
  css,
  html,
  LitElement,
  nothing,
  render,
  type TemplateResult,
} from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { until } from 'lit/directives/until.js';
import {
  hashLocationPlugin,
  RejectType,
  type TargetState,
  type Transition,
} from '@uirouter/core';
import {
  TransitionController,
  UIRouterLit,
  uiSref,
  uiSrefActive,
  type LitStateDeclaration,
  type RoutedLitTemplate,
} from 'lit-ui-router';

const REQUEST_MS = 1200;

/** A transition that settles sooner never shows its pending view. */
const PENDING_DELAY_MS = 150;

/** The simulated server; the shell's checkbox sets `failing`. */
const server = { failing: false };

function request<T>(value: T): Promise<T> {
  const { failing } = server;

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (failing) reject(new Error('The server did not answer.'));
      else resolve(value);
    }, REQUEST_MS);
  });
}

/** What a state's `data` carries for the shell and the error hook; child states inherit it. */
interface ViewData {
  pending?: () => TemplateResult;
  errorState?: string;
}

function viewData(trans: Transition): ViewData | undefined {
  // SAFETY: every state in this app declares its `data` as ViewData
  return trans.to().data as ViewData | undefined;
}

const spinner = () =>
  html`<p class="pending" role="status"><span class="spin"></span>Loading…</p>`;

const skeleton = (lines: number) =>
  html`<div class="skeleton" role="status" aria-label="Loading">
    ${Array.from({ length: lines }, () => html`<span></span>`)}
  </div>`;

const accountSkeleton = () =>
  html`<h3>Account</h3>
    ${skeleton(3)}`;

/** The failed target arrives as the `failed` param; retrying is a new transition to it. */
const errorView =
  (title: string): RoutedLitTemplate =>
  ({ router, transition }) => {
    // SAFETY: the onError hook is the only writer of `failed`
    const failed = transition?.params().failed as TargetState | undefined;

    const retry = () => {
      if (failed) void router.stateService.go(failed.state(), failed.params());
    };

    return html`<div class="error" role="alert">
      <h3>${title}</h3>
      <p>
        <code>${failed?.name()}</code> failed to load. Clear
        <em>Fail requests</em>, then retry.
      </p>
      <button type="button" @click=${retry}>Retry</button>
    </div>`;
  };

interface ReportResolves {
  report: string[];
}

interface ProfileResolves {
  profile: { name: string; plan: string };
}

interface ActivityResolves {
  activity: Promise<string[]>;
}

const homeState = {
  name: 'home',
  url: '/home',
  component: () =>
    html`<h3>Home</h3>
      <p>No resolves, so the view changes at once.</p>`,
} satisfies LitStateDeclaration;

const reportState = {
  name: 'report',
  url: '/report',
  component: ({ resolves }) =>
    html`<h3>Report</h3>
      <ul>
        ${resolves.report.map((line) => html`<li>${line}</li>`)}
      </ul>`,
  resolve: [
    {
      token: 'report',
      resolveFn: () =>
        request(['Visits up 4%', 'Signups flat', 'Churn down 1%']),
    },
  ],
} satisfies LitStateDeclaration<ReportResolves>;

const errorState = {
  name: 'error',
  params: { failed: null },
  component: errorView('Something went wrong'),
} satisfies LitStateDeclaration;

const accountState = {
  name: 'account',
  url: '/account',
  redirectTo: 'account.profile',
  data: {
    pending: accountSkeleton,
    errorState: 'account.error',
  } satisfies ViewData,
  component: () =>
    html`<h3>Account</h3>
      <nav class="tabs" aria-label="Account">
        <a
          ${uiSref('account.profile')}
          ${uiSrefActive({ activeClasses: ['active'] })}
          >Profile</a
        >
        <a
          ${uiSref('account.activity')}
          ${uiSrefActive({ activeClasses: ['active'] })}
          >Activity</a
        >
      </nav>
      <ui-view></ui-view>`,
} satisfies LitStateDeclaration;

const profileState = {
  name: 'account.profile',
  url: '/profile',
  component: ({ resolves }) =>
    html`<p>
      ${resolves.profile.name}, on the ${resolves.profile.plan} plan.
    </p>`,
  resolve: [
    {
      token: 'profile',
      resolveFn: () => request({ name: 'Ada Lovelace', plan: 'Analytical' }),
    },
  ],
} satisfies LitStateDeclaration<ProfileResolves>;

// NOWAIT: the transition succeeds at once and the view renders the promise.
const activityState = {
  name: 'account.activity',
  url: '/activity',
  component: ({ resolves, router }) =>
    html`${until(
      resolves.activity.then(
        (items) =>
          html`<ul>
            ${items.map((item) => html`<li>${item}</li>`)}
          </ul>`,
        () =>
          html`<div class="error" role="alert">
            <p>Activity failed to load.</p>
            <button
              type="button"
              @click=${() => void router.stateService.reload('account.activity')}
            >
              Retry
            </button>
          </div>`,
      ),
      skeleton(3),
    )}`,
  resolve: [
    {
      token: 'activity',
      resolveFn: () =>
        request(['Signed in', 'Changed plan', 'Downloaded invoice']),
    },
  ],
  resolvePolicy: { async: 'NOWAIT' },
} satisfies LitStateDeclaration<ActivityResolves>;

const accountErrorState = {
  name: 'account.error',
  params: { failed: null },
  component: errorView('Account unavailable'),
} satisfies LitStateDeclaration;

@customElement('app-shell')
export class AppShell extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    h2 {
      margin: 0 0 4px;
      font-size: 1.17em;
    }
    h3 {
      margin: 0 0 8px;
      font-size: 1em;
    }
    p {
      margin: 0 0 12px;
    }
    nav {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-block: 16px;
    }
    nav a {
      padding: 6px 12px;
      border-radius: 4px;
      color: inherit;
      text-decoration: none;
      background: light-dark(#f0f0f0, #2c2c2c);
    }
    nav a.active {
      font-weight: 700;
      background: light-dark(#dcdcdc, #444);
    }
    nav.tabs {
      margin-block: 0 12px;
    }
    main {
      min-height: 9em;
      padding: 12px 16px;
      border: 1px solid light-dark(#ccc, #444);
      border-radius: 4px;
    }
    ui-view {
      display: block;
    }
    ui-view[hidden] {
      display: none;
    }
    ul {
      margin: 0;
      padding-inline-start: 1.25em;
    }
    .pending {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .spin {
      inline-size: 1em;
      block-size: 1em;
      border: 2px solid light-dark(#ccc, #555);
      border-block-start-color: currentColor;
      border-radius: 50%;
    }
    .skeleton {
      display: grid;
      gap: 8px;
    }
    .skeleton span {
      block-size: 1em;
      border-radius: 4px;
      background: light-dark(#eee, #333);
    }
    .skeleton span:last-child {
      inline-size: 60%;
    }
    .error {
      color: light-dark(#a30000, #ff9a9a);
    }
    button {
      font: inherit;
    }
    @media (prefers-reduced-motion: no-preference) {
      .spin {
        animation: spin 0.8s linear infinite;
      }
    }
    @keyframes spin {
      to {
        transform: rotate(1turn);
      }
    }
  `;

  @state() private pending?: Transition;

  @state() private showPending = false;

  readonly transitions = new TransitionController(this, {
    events: ['onStart'],
    callback: (trans, reason) => {
      if (reason !== 'onStart' || !trans) return;
      this.pending = trans;

      const timer = setTimeout(() => {
        if (this.pending === trans) this.showPending = true;
      }, PENDING_DELAY_MS);

      // A superseded transition settles too; only the latest clears the pending view.
      const done = () => {
        clearTimeout(timer);

        if (this.pending !== trans) return;
        this.pending = undefined;
        this.showPending = false;
      };

      void trans.promise.then(done, done);
    },
  });

  render() {
    const pendingView =
      (this.pending && viewData(this.pending)?.pending) ?? spinner;

    return html`
      <h2>Loading and error views</h2>
      <p>
        Report and Profile wait on a slow resolve; Activity renders before its
        data arrives. Check <em>Fail requests</em> to see each error view.
      </p>
      <nav aria-label="Loading and error views example">
        <a ${uiSref('home')} ${uiSrefActive({ activeClasses: ['active'] })}
          >Home</a
        >
        <a ${uiSref('report')} ${uiSrefActive({ activeClasses: ['active'] })}
          >Report</a
        >
        <a ${uiSref('account')} ${uiSrefActive({ activeClasses: ['active'] })}
          >Account</a
        >
      </nav>
      <p>
        <label>
          <input
            type="checkbox"
            @change=${(event: Event) => {
              // SAFETY: the listener is bound on the checkbox
              server.failing = (
                event.currentTarget as HTMLInputElement
              ).checked;
            }}
          />
          Fail requests
        </label>
      </p>
      <main aria-busy=${this.pending ? 'true' : nothing}>
        ${this.showPending ? pendingView() : nothing}
        <ui-view ?hidden=${this.showPending}></ui-view>
      </main>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-shell': AppShell;
  }
}

const router = new UIRouterLit();

router.plugin(hashLocationPlugin);

for (const state of [
  homeState,
  reportState,
  errorState,
  accountState,
  profileState,
  activityState,
  accountErrorState,
]) {
  router.stateRegistry.register(state);
}

// A resolve that rejected or a hook that threw goes to the error state the target inherits.
router.transitionService.onError({}, (trans) => {
  if (trans.error()?.type !== RejectType.ERROR) return;

  const target = viewData(trans)?.errorState ?? errorState.name;

  // An error state inherits its own name, so its failure stops here.
  if (target === trans.to().name) return;

  void router.stateService.go(
    target,
    { failed: trans.targetState() },
    { location: false },
  );
});

router.urlService.rules.initial({ state: 'home' });

router.start();

render(
  html`
    <ui-router .uiRouter=${router}>
      <app-shell></app-shell>
    </ui-router>
  `,
  document.getElementById('root')!,
);
