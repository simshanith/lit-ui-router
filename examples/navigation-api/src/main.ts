import { html, LitElement, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  UIRouterLit,
  uiSrefActive,
  type LitStateDeclaration,
} from 'lit-ui-router';
import {
  isUIRouterNavigateEvent,
  navigationLocationPlugin,
  type NavigationLocationPluginOptions,
} from 'ui-router-navigation-location-plugin';

import { uiSref } from './typed-ui-sref.js';

const supported = 'navigation' in window;

const PREFETCH_MS = 900;

const MAX_LOG_ENTRIES = 40;

/** The `info` the "Leave anyway" button passes, so the guard lets its own navigation through. */
const LEAVE_CONFIRMED = { leaveConfirmed: true };

interface LogEntry {
  id: number;
  text: string;
}

/** A URL relative to the app's `<base href>`, for the log. */
function label(url: string): string {
  return url.startsWith(document.baseURI)
    ? url.slice(document.baseURI.length) || './'
    : url;
}

// Stands in for fetch(url, { signal }): resolves after `ms`, rejects when `signal` aborts.
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

const FOLDERS = {
  inbox: {
    title: 'Inbox',
    body: html`A router state. Its links are <code>uiSref</code>s.`,
  },
  archive: {
    title: 'Archive',
    body: html`The same state with another parameter, and the same router.`,
  },
};

// A query parameter keeps every router URL on the one path a static host serves.
const folderState = {
  name: 'folder',
  url: '/?folder',
  params: { folder: { type: 'string', value: 'inbox' } },
  component: ({ transition }) => {
    const { title, body } =
      transition?.params().folder === 'archive'
        ? FOLDERS.archive
        : FOLDERS.inbox;

    return html`<h3>${title}</h3>
      <p>${body}</p>`;
  },
} as const satisfies LitStateDeclaration;

declare module 'ui-router-registry' {
  interface Register {
    states: typeof folderState;
  }
}

@customElement('app-root')
export class AppRoot extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    h2 {
      margin: 0 0 4px;
      font-size: 1.17em;
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
    nav a.external {
      margin-inline-start: auto;
      text-decoration: underline;
      background: none;
    }
    ui-view {
      display: block;
      min-height: 5.5em;
    }
    h3 {
      margin: 0 0 4px;
      font-size: 1em;
    }
    label {
      display: block;
      font-weight: 600;
      margin-block-end: 4px;
    }
    textarea {
      box-sizing: border-box;
      width: 100%;
      font: inherit;
    }
    .guard {
      min-height: 2.5em;
      margin-block: 8px;
    }
    .guard button {
      margin-inline-start: 8px;
      font: inherit;
    }
    .note {
      margin-block: 8px 0;
      font-size: 0.9em;
    }
    ol {
      box-sizing: border-box;
      height: 14em;
      margin: 0;
      padding: 8px 8px 8px 3em;
      overflow: auto;
      font-family: ui-monospace, monospace;
      font-size: 13px;
      border: 1px solid light-dark(#ccc, #444);
      border-radius: 4px;
    }
  `;

  private readonly router = new UIRouterLit();

  @state() private draft = '';

  /** A navigation that would leave the app, held until the reader decides. */
  @state() private held?: string;

  @state() private entries: LogEntry[] = [];

  private nextId = 1;

  private leaving = false;

  constructor() {
    super();

    if (!supported) return;
    // Work tied to a router navigation goes through the plugin's own option.
    this.router.plugin(navigationLocationPlugin, {
      intercept: (event) => ({
        handler: () => this.prefetch(event.destination.url, event.signal),
      }),
    } satisfies NavigationLocationPluginOptions);
    this.router.stateRegistry.register(folderState);
    this.router.urlService.rules.initial({ state: 'folder' });
  }

  connectedCallback(): void {
    super.connectedCallback();

    if (!supported) return;
    navigation.addEventListener('navigate', this.onNavigate);
    navigation.addEventListener('navigatesuccess', this.onSuccess);
    navigation.addEventListener('navigateerror', this.onError);
    window.addEventListener('beforeunload', this.onBeforeUnload);
    this.router.start();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    if (!supported) return;
    navigation.removeEventListener('navigate', this.onNavigate);
    navigation.removeEventListener('navigatesuccess', this.onSuccess);
    navigation.removeEventListener('navigateerror', this.onError);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
  }

  private log(text: string): void {
    this.entries = [{ id: this.nextId++, text }, ...this.entries].slice(
      0,
      MAX_LOG_ENTRIES,
    );
  }

  private async prefetch(url: string, signal: AbortSignal): Promise<void> {
    this.log(`prefetch ${label(url)}: started`);

    try {
      await delay(PREFETCH_MS, signal);
      this.log(`prefetch ${label(url)}: done`);
    } catch {
      this.log(`prefetch ${label(url)}: aborted with its navigation`);
    }
  }

  // The app's own navigate listener: it acts only on navigations the router does not own.
  private readonly onNavigate = (event: NavigateEvent): void => {
    const where = `${event.navigationType} ${label(event.destination.url)}`;

    if (isUIRouterNavigateEvent(event)) {
      this.log(`navigate ${where}: the router's, the plugin intercepts it`);

      return;
    }

    if (
      event.navigationType === 'traverse' ||
      event.navigationType === 'reload' ||
      event.hashChange ||
      event.downloadRequest !== null
    ) {
      this.log(`navigate ${where}: not a page load to guard`);

      return;
    }

    if (!this.draft || event.info === LEAVE_CONFIRMED) {
      this.leaving = true;
      this.log(`navigate ${where}: leaves the app`);

      return;
    }

    if (!event.cancelable) {
      this.log(`navigate ${where}: not cancelable, beforeunload asks`);

      return;
    }

    event.preventDefault();
    this.held = event.destination.url;
    this.log(`navigate ${where}: held, the draft is unsaved`);
  };

  private readonly onSuccess = (): void => {
    this.log('navigatesuccess');
  };

  private readonly onError = (event: ErrorEvent): void => {
    const error: unknown = event.error;
    this.log(
      `navigateerror: ${error instanceof Error ? error.name : event.message}`,
    );
  };

  // The navigate event never fires for a typed URL or a closed tab; beforeunload stays the backstop.
  private readonly onBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (this.draft && !this.leaving) event.preventDefault();
  };

  private leave(): void {
    const url = this.held;

    if (!url) return;
    this.held = undefined;
    navigation.navigate(url, { info: LEAVE_CONFIRMED });
  }

  private stay(): void {
    this.log(`stayed, ${label(this.held ?? '')} not loaded`);
    this.held = undefined;
  }

  private renderGuard() {
    if (!this.held) {
      return html`<p class="guard">
        Type a draft, then follow <em>Sign out</em>.
      </p>`;
    }

    return html`<p class="guard" role="alert">
      The draft is unsaved.
      <button type="button" @click=${() => this.leave()}>Leave anyway</button>
      <button type="button" @click=${() => this.stay()}>Stay</button>
    </p>`;
  }

  render() {
    if (!supported) {
      return html`<p>
        This browser has no Navigation API, so there is no
        <code>navigate</code> event to show. An app here falls back to
        <code>pushStateLocationPlugin</code>.
      </p>`;
    }

    return html`
      <ui-router .uiRouter=${this.router}>
        <h2>Reaching past the router</h2>
        <p>
          The router owns Inbox and Archive. It does not own Sign out: that link
          loads a page the server renders, and only a
          <code>navigate</code> listener sees it coming.
        </p>

        <nav aria-label="Navigation API example">
          <a
            ${uiSref('folder', { folder: 'inbox' })}
            ${uiSrefActive({ activeClasses: ['active'] })}
            >Inbox</a
          >
          <a
            ${uiSref('folder', { folder: 'archive' })}
            ${uiSrefActive({ activeClasses: ['active'] })}
            >Archive</a
          >
          <a class="external" href="signed-out.html">Sign out</a>
        </nav>

        <ui-view></ui-view>

        <label for="draft">Draft (kept across router navigations)</label>
        <textarea
          id="draft"
          rows="2"
          .value=${this.draft}
          @input=${(event: InputEvent) => {
            // SAFETY: the listener is bound on the textarea
            this.draft = (event.currentTarget as HTMLTextAreaElement).value;
          }}
        ></textarea>
        ${this.renderGuard()}

        <ol aria-label="Navigation log">
          ${this.entries.map(
            (entry) => html`<li value=${entry.id}>${entry.text}</li>`,
          )}
        </ol>
        <p class="note">
          The log is a <code>navigate</code> listener too, so it sees router
          navigations that a <code>history.pushState</code> patch never would:
          <a
            href="https://lit-ui-router.dev/packages/navigation-plugin#what-else-observes-navigation"
            target="_blank"
            rel="noopener"
            >what else observes navigation</a
          >.
        </p>
      </ui-router>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-root': AppRoot;
  }
}
