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

// A cytoscape lane's keyboard: with its container focused, ← → step the pin through `order()`, Escape clears.
export const LANE_KEYS_JS = `  function atlasLaneKeys(stage, order, pinned, tap) {
    stage.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) {
        var list = order().toArray(), p = pinned(), at = -1;
        for (var i = 0; i < list.length; i++) if (p && list[i].same(p)) at = i;
        var next = list[at < 0 ? (d > 0 ? 0 : list.length - 1) : (at + d + list.length) % list.length];
        if (next && !(p && next.same(p))) tap(next);
      } else if (e.key === 'Escape') tap(null);
      else return;
      e.preventDefault();
      e.stopPropagation();
    });
  }
`;
