/**
 * The sheets' three-state theming, kept: no `data-theme` means follow
 * `prefers-color-scheme`; `light`/`dark` pin it. atlas.css already declares
 * every token for all three states, so this only has to set the attribute.
 */
export type ThemeChoice = 'auto' | 'light' | 'dark';

const KEY = 'atlas-theme';

export function readTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
  } catch {
    // private windows and blocked site data both throw here; auto is right
  }
  return 'auto';
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // a remembered preference is a convenience, never a requirement
  }
}
