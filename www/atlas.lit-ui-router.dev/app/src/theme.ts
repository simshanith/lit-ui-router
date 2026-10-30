/**
 * The sheets' three-state theming, kept: no `data-theme` means follow
 * `prefers-color-scheme`; `light`/`dark` pin it. atlas.css already declares
 * every token for all three states, so this only has to set the attribute.
 */
export type ThemeChoice = 'auto' | 'light' | 'dark';

export const THEME_KEY = 'atlas-theme';

export function readTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
  } catch {
    // private windows and blocked site data both throw here; auto is right
  }
  // No stored preference: honour a data-theme the HOST already stamped on the
  // root — a claude.ai Artifact pins the viewer's theme that way, and removing
  // it (as 'auto' would) would drop the page out of the theme it was given.
  // Optional: @lit-labs/ssr's dom shim has no documentElement (prerender.ts).
  const stamped = document.documentElement?.getAttribute('data-theme');
  if (stamped === 'light' || stamped === 'dark') return stamped;
  return 'auto';
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    // a remembered preference is a convenience, never a requirement
  }
}

/**
 * The pre-paint half. vite.config.ts inlines it into <head> as a classic
 * script ahead of the stylesheets, so a pinned theme paints from the first
 * frame. It takes the key as its argument and reads nothing but globals, and
 * test/theme.test.ts proves it lands where readTheme and applyTheme land: a
 * stored light or dark is set, a stored auto is removed, and with nothing
 * stored a data-theme the host stamped is kept.
 */
export function prepaintTheme(key: string): void {
  const root = document.documentElement;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(key);
  } catch {
    // private windows and blocked site data throw here; the sheet's default stands
  }
  if (stored === 'light' || stored === 'dark') root.setAttribute('data-theme', stored);
  else if (stored === 'auto') root.removeAttribute('data-theme');
}

/** The inline script's text: prepaintTheme applied to the one key. */
export const prepaintScript = (): string =>
  `(${prepaintTheme.toString()})(${JSON.stringify(THEME_KEY)})`;
