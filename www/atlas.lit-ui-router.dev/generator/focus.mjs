// The focus seam every interactive plate inlines: its selection is the url's `?focus=`, one value per page.
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

// A sheet's plate opens on <atlas-plate>'s data-focus ('' = none), set before its scripts run, and hears
// each later url move as a non-bubbling `atlas-focus-set` on that host; with no host it reads the url.
export const PLATE_FOCUS_JS = `${FOCUS_JS}  function atlasFocusHost(from, apply) {
    var host = from.closest('atlas-plate');
    if (host) host.addEventListener('atlas-focus-set', function (e) { apply(e.detail.focus); });
    return atlasFocusRead(host ? host.getAttribute('data-focus') || null : undefined);
  }
`;
