import type { ViewFill, ViewInfo } from './schema.ts';

/** A `ui-view` in the nesting `fqn` describes, with the views registered inside it. */
export interface ViewNode {
  /** The view as the snapshot records it. */
  view: ViewInfo;
  /** The enclosing view's id; null for a view at the top. */
  parent: number | null;
  /** From 1 at the top. */
  depth: number;
  /** The views registered inside this one. */
  children: ViewNode[];
}

/**
 * What a renderer adds to the panel's Views: where a view is on the page. The panel calls it when one is set, and
 * only for the live router, never for an imported session.
 */
export interface ViewLocator {
  /** Marks the view's place on the page; null takes the mark away. */
  highlight(view: ViewInfo | null): void;
  /** Where the page shows the view, in words; null when the page has no element for it. */
  describe?(view: ViewInfo): string | null;
}

const parentFqn = (fqn: string): string | null => {
  const dot = fqn.lastIndexOf('.');

  return dot === -1 ? null : fqn.slice(0, dot);
};

// Two views can share an fqn; the one filled by the state a view was created in is its parent.
const parentOf = (
  view: ViewInfo,
  byFqn: ReadonlyMap<string, readonly ViewInfo[]>,
): ViewInfo | undefined => {
  const fqn = parentFqn(view.fqn);
  const candidates = fqn === null ? [] : (byFqn.get(fqn) ?? []);

  return (
    candidates.find((candidate) => candidate.fill?.state === view.context) ??
    candidates[0]
  );
};

/**
 * Nests views by their `fqn`: a view sits inside the view named by its `fqn` without the last segment. A view whose
 * enclosing view is not registered is drawn at the top. Siblings keep the order they are given in.
 */
export const viewTree = (views: readonly ViewInfo[]): ViewNode[] => {
  const byFqn = new Map<string, ViewInfo[]>();

  for (const view of views)
    byFqn.set(view.fqn, [...(byFqn.get(view.fqn) ?? []), view]);

  const parents = new Map(
    views.map((view) => [view.id, parentOf(view, byFqn)?.id ?? null]),
  );

  const build = (parent: number | null, depth: number): ViewNode[] =>
    views.flatMap((view) =>
      parents.get(view.id) === parent
        ? [{ view, parent, depth, children: build(view.id, depth + 1) }]
        : [],
    );

  // A cycle cannot form: a parent's fqn is always shorter than its child's.
  return build(null, 1);
};

/** A view config's target as a state's `views` can write it, `name@anchor`; the root's anchor is empty. */
export const targetText = ({ target }: ViewFill): string =>
  `${target.name}@${target.anchor}`;

/** The views a state fills, inside the views that hold them, and how many other views the snapshot has. */
export interface ViewPath {
  /** The state the views are filled by: the one asked for, or the nearest of its ancestors that fills one. */
  state: string;
  /** The view tree pruned to the state's views and the views that hold them, in snapshot order. */
  nodes: ViewNode[];
  /** Views on no branch of `nodes`. */
  others: number;
}

const prune = (nodes: readonly ViewNode[], state: string): ViewNode[] =>
  nodes.flatMap((node) => {
    const children = prune(node.children, state);

    return node.view.fill?.state === state || children.length
      ? [{ ...node, children }]
      : [];
  });

const count = (nodes: readonly ViewNode[]): number =>
  nodes.reduce((total, node) => total + 1 + count(node.children), 0);

/**
 * The view path of `state`: each view it fills and the views it sits inside. A state that fills none gives the path
 * of the first of `ancestors`, nearest first, that does; null when none of them fills a view.
 */
export const viewPath = (
  views: readonly ViewInfo[],
  state: string,
  ancestors: readonly string[] = [],
): ViewPath | null => {
  const tree = viewTree(views);

  for (const name of [state, ...ancestors]) {
    const nodes = prune(tree, name);

    if (nodes.length)
      return { state: name, nodes, others: views.length - count(nodes) };
  }

  return null;
};
