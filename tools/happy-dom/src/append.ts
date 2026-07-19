/**
 * Appends `parent` into `container`, then `children` into `parent` —
 * parent-first.
 *
 * The sole site of the happy-dom ordering workaround: happy-dom fires
 * connectedCallback child-before-parent when an assembled subtree is
 * inserted (real browsers upgrade in shadow-including tree order, parent
 * first), which breaks parent-provided-context patterns — an ancestor
 * attaching a listener in connectedCallback that descendants dispatch to on
 * connect. Connecting the parent before appending children is semantically
 * equivalent in real browsers. Guarded by the conformance canary beside this
 * file (src/specs/happy-dom-conformance.spec.ts): when the canary fails,
 * happy-dom fixed the ordering upstream — inline plain appends at the call
 * sites and delete this workaround.
 */
export function appendParentFirst(
  container: ParentNode,
  parent: Element,
  ...children: Node[]
): void {
  container.appendChild(parent);
  parent.append(...children);
}
