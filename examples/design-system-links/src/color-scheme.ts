import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * Each Spectrum color stop is a separate theme fragment, and importing it is
 * what registers it with `sp-theme` — so only the stop in use has to ship, and
 * the other arrives on its own chunk if the preference ever flips.
 */
const themeFragments = {
  light: () => import('@spectrum-web-components/theme/theme-light.js'),
  dark: () => import('@spectrum-web-components/theme/theme-dark.js'),
} satisfies Record<string, () => Promise<unknown>>;

export type ThemeColor = keyof typeof themeFragments;

/**
 * Tracks `prefers-color-scheme` and loads the matching Spectrum theme fragment
 * on demand, exposing the stop that is both preferred and registered.
 *
 * `sp-theme` takes a literal color stop — `lightest`, `light`, `dark` or
 * `darkest`, with no `auto` — so following the reader's OS preference is the
 * host's job. The media query stays the single source of truth: a fragment
 * that finishes loading re-reads it rather than applying the stop it was
 * asked for, so overlapping flips converge on the current preference without
 * anyone tracking which load started last.
 */
export class ColorSchemeController implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  readonly #query = window.matchMedia('(prefers-color-scheme: dark)');
  readonly #loaded = new Set<ThemeColor>();
  #applied?: ThemeColor;

  constructor(host: ReactiveControllerHost) {
    this.#host = host;
    host.addController(this);
  }

  /** the preferred stop, once its fragment is registered; undefined until then */
  get color(): ThemeColor | undefined {
    return this.#applied;
  }

  get #preferred(): ThemeColor {
    return this.#query.matches ? 'dark' : 'light';
  }

  hostConnected(): void {
    this.#query.addEventListener('change', this.#onChange);
    void this.#adopt();
  }

  hostDisconnected(): void {
    this.#query.removeEventListener('change', this.#onChange);
  }

  readonly #onChange = () => void this.#adopt();

  async #adopt(): Promise<void> {
    const wanted = this.#preferred;
    if (!this.#loaded.has(wanted)) {
      try {
        await themeFragments[wanted]();
        this.#loaded.add(wanted);
      } catch (error) {
        // a fragment that never arrives must not blank the app: keep the stop
        // already on screen, or adopt this one unthemed if there is none yet
        console.error(`could not load the ${wanted} theme fragment`, error);
        this.#applied ??= wanted;
        this.#host.requestUpdate();
        return;
      }
    }
    // re-read the query: whatever it says now is what should be on screen, and
    // the previous stop stays applied while an unloaded one is still in flight
    const preferred = this.#preferred;
    if (this.#loaded.has(preferred)) this.#applied = preferred;
    this.#host.requestUpdate();
  }
}
