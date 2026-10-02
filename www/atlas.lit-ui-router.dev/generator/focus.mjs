// The focus seam every interactive plate inlines: its selection is the url's `?focus=`.
// atlasFocusPush raises `atlas-focus`; the routed app takes it, a standalone page replaceStates.
// atlasFocusRead takes the host's value (null = nothing); undefined falls back to location.search.
export const FOCUS_JS = `  function atlasFocusPush(from, focus) {
    var ev = new CustomEvent('atlas-focus', { detail: { focus: focus }, bubbles: true, composed: true, cancelable: true });
    if (!from.dispatchEvent(ev)) return;
    var url = new URL(location.href);
    if (focus === null) url.searchParams.delete('focus');
    else url.searchParams.set('focus', focus);
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }
  function atlasFocusRead(initial) {
    return initial !== undefined ? initial : new URLSearchParams(location.search).get('focus');
  }
`;
