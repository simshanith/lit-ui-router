/**
 * The seam between a router that owns the DOM and content that is plain HTML.
 *
 * Three consumer findings live in this file:
 *
 *  1. Inserted markup never executes a <script>. `innerHTML` (and lit's
 *     `unsafeHTML`, which uses it) marks scripts "already started", so the two
 *     interactive sheets (2B, 12i) would mount their JSON islands and their
 *     `<div id="cb-cy">` and then sit there dead. The fix is to REPLACE each
 *     script node with a freshly created one — the only way a parser-less
 *     insertion runs code. `<style>` DOES apply through innerHTML; only
 *     scripts don't, which is why the plates are styled but inert.
 *  2. The islands are read with `document.getElementById`, so the fragment
 *     must land in the LIGHT DOM. Every element here overrides
 *     `createRenderRoot()` to return itself — which also lets the generated
 *     `sheets/atlas.css` reach the plates without `::part` plumbing.
 *  3. `uiSref` is an element-part directive and cannot be attached to
 *     imperatively inserted markup, so the generator writes the cross-sheet
 *     references as real `<a class="xref" href>` elements and navigation is
 *     delegated: a click raises `atlas-xref`, which main.ts turns into a
 *     `stateService.go`. The href is the no-JS/prerender path and the event is
 *     the SPA path — one link serves both.
 */

/** Detail of the `atlas-xref` event a generated cross-reference raises. */
export interface XrefDetail {
  num: string;
}

let cytoscapeLoaded: Promise<unknown> | null = null;

/**
 * The two interactive lanes call a global `cytoscape`. Their standalone pages
 * get it from a CDN <script>; emit-app.mjs strips that tag and the app bundles
 * the library instead, so the app carries no external origin.
 */
export function loadCytoscape(): Promise<unknown> {
  cytoscapeLoaded ??= import('cytoscape').then((module) => {
    (globalThis as Record<string, unknown>)['cytoscape'] = module.default;
    return module.default;
  });
  return cytoscapeLoaded;
}

const executable = (script: HTMLScriptElement): boolean => {
  const type = script.type.trim().toLowerCase();
  return type === '' || type === 'module' || type === 'text/javascript';
};

/** Re-create every executable script inside `host` so the browser runs it. */
export function runScripts(host: HTMLElement): void {
  // Snapshot first: replaceWith mutates a live NodeList underneath us.
  for (const old of [...host.querySelectorAll('script')]) {
    if (!executable(old)) continue; // the JSON islands stay exactly where they are
    const fresh = document.createElement('script');
    for (const attr of old.attributes) fresh.setAttribute(attr.name, attr.value);
    fresh.textContent = old.textContent;
    old.replaceWith(fresh);
  }
}

/** Delegated navigation for the generated `a.xref` links. */
export function onXrefClick(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as Element | null)?.closest?.(
    'a.xref',
  ) as HTMLAnchorElement | null;
  const num = anchor?.dataset['sheet'];
  if (!anchor || !num) return;
  event.preventDefault();
  anchor.dispatchEvent(
    new CustomEvent<XrefDetail>('atlas-xref', {
      detail: { num },
      bubbles: true,
      composed: true,
    }),
  );
}
