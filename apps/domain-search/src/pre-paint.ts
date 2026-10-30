// The classic inline script the prerender writes right after the input: it runs while the document parses, before first paint.

export const INPUT_ID = 'domain-search-q';

/** Set on `<html>` while a query is present and the app has not booted, so CSS draws the results skeleton. */
export const QUERY_MARK = 'data-domain-search-query';

/** Set on `<html>` once the app has booted. */
export const BOOTED_MARK = 'data-domain-search-booted';

/** Dispatched on `document` once the app has booted; the script stops syncing the url. */
export const BOOT_EVENT = 'domain-search:boot';

/** Set on the input once the visitor types, so the app takes its value over the url's. */
export const TYPED_MARK = 'data-typed';

export const STORAGE_KEY = 'domain-search:last';

export const QUERY_PARAM = 'q';

/** What the page template writes where the script goes; the prerender swaps it for the script. */
export const PRE_PAINT_SLOT = '<!--domain-search:pre-paint-->';

export interface PrePaintConfig {
  input: string;
  param: string;
  storageKey: string;
  queryMark: string;
  typedMark: string;
  bootEvent: string;
}

export const prePaintConfig: PrePaintConfig = {
  input: INPUT_ID,
  param: QUERY_PARAM,
  storageKey: STORAGE_KEY,
  queryMark: QUERY_MARK,
  typedMark: TYPED_MARK,
  bootEvent: BOOT_EVENT,
};

/**
 * Fills the input from the url's query, else the last search, focuses it,
 * marks `<html>` for the query's presence, and keeps the url in step with
 * typing until the app boots. A value the input already holds (restored by
 * the browser, or typed before the script arrived) is kept and synced. Inlined
 * by `toString()`, so it reads only its argument and globals, and its body
 * holds no comments, so whitespace can collapse.
 */
export function prePaint(config: PrePaintConfig): void {
  const input = document.getElementById(config.input);

  if (!(input instanceof HTMLInputElement)) return;
  const root = document.documentElement;
  const query = new URL(location.href).searchParams.get(config.param);
  const typed = input.value;
  let stored: string | null;

  try {
    stored = localStorage.getItem(config.storageKey);
  } catch {
    stored = null;
  }

  const sync = (): void => {
    const url = new URL(location.href);

    if (input.value) url.searchParams.set(config.param, input.value);
    else url.searchParams.delete(config.param);
    history.replaceState(history.state, '', url);
    input.setAttribute(config.typedMark, '');
    root.toggleAttribute(config.queryMark, Boolean(input.value.trim()));
  };

  input.addEventListener('input', sync);
  document.addEventListener(
    config.bootEvent,
    () => input.removeEventListener('input', sync),
    { once: true },
  );
  input.focus();

  if (typed) {
    sync();
  } else {
    input.value = query ?? stored ?? '';
    root.toggleAttribute(config.queryMark, Boolean(query?.trim()));
  }

  input.setSelectionRange(input.value.length, input.value.length);
}

/** {@link prePaint}'s source as the page inlines it. */
export const prePaintSource = (): string =>
  prePaint.toString().replace(/\s+/g, ' ');

/** The script element the prerender writes in place of {@link PRE_PAINT_SLOT}. */
export const prePaintScript = (
  config: PrePaintConfig = prePaintConfig,
): string =>
  `<script>(${prePaintSource()})(${JSON.stringify(config)});</script>`;
