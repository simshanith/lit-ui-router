// The diff page's file tree: the shown files as a @pierre/trees tree, loaded beside the tarballs.
import { FileTree, type GitStatusEntry } from '@pierre/trees';

import { compareNames } from './npm-diff/file-filter.ts';

/** One changed file as the tree lists it. */
export interface TreeFile {
  path: string;
  status: GitStatusEntry['status'];
  added: number;
  removed: number;
}

/** The mounted tree. */
export interface DiffTree {
  /** Lists `files`, in the order `comparePaths` sorts them. */
  show(files: readonly TreeFile[]): void;
  /** Marks `path` as the file in view, scrolling the tree to it. */
  mark(path: string): void;
}

const LETTERS: Readonly<Record<TreeFile['status'], string>> = {
  added: 'A',
  deleted: 'D',
  ignored: 'I',
  modified: 'M',
  renamed: 'R',
  untracked: 'U',
};

// Counts and status letters are generated content: axe counts any text in a row toward the visible label its name must contain.
const ROW_CSS = `
[data-item-section="decoration"], [data-item-section="git"] { display: none; }
[data-item-type="file"]::before { order: 1; flex: 1 1 0; min-inline-size: 0; text-align: end; white-space: pre; font-variant-numeric: tabular-nums; color: var(--trees-fg-muted); }
[data-item-type="file"]::after { order: 2; flex: none; inline-size: 1.5em; text-align: center; font-weight: 600; }
`;

/** Each file row's line counts and status letter. */
const rowCss = (files: readonly TreeFile[]): string =>
  files
    .map((file) => {
      const row = `[data-item-type="file"][data-item-path="${CSS.escape(file.path)}"]`;

      const counts = [
        ...(file.added ? [`+${file.added}`] : []),
        ...(file.removed ? [`−${file.removed}`] : []),
      ].join(' ');

      return `${row}::before { content: "${counts}"; }\n${row}::after { content: "${LETTERS[file.status]}"; color: var(--trees-status-${file.status}); }`;
    })
    .join('\n');

const describe = (file: TreeFile): string =>
  [
    file.status,
    ...(file.added ? [`${file.added} added`] : []),
    ...(file.removed ? [`${file.removed} removed`] : []),
  ].join(', ');

/** Adds each file row's status and line counts to its name, which carries the file name alone. */
const describeRows = (
  root: ShadowRoot,
  fileAt: (path: string) => TreeFile | undefined,
): void => {
  const names = new WeakMap<Element, { name: string; label: string }>();

  const update = (): void => {
    for (const row of root.querySelectorAll<HTMLElement>(
      '[role="treeitem"][data-item-type="file"]',
    )) {
      const current = row.getAttribute('aria-label') ?? '';
      const own = names.get(row);
      const name = own?.label === current ? own.name : current;
      const file = fileAt(row.dataset.itemPath ?? '');
      const label = file ? `${name}, ${describe(file)}` : name;

      if (label !== current) row.setAttribute('aria-label', label);
      names.set(row, { name, label });
    }
  };

  new MutationObserver(update).observe(root, {
    subtree: true,
    childList: true,
    attributeFilter: ['aria-label', 'data-item-path'],
  });
  update();
};

/** Mounts a tree in `container` that calls `onPick` with a file the reader chooses. */
export const mountDiffTree = (
  container: HTMLElement,
  onPick: (path: string) => void,
): DiffTree => {
  const byPath = new Map<string, TreeFile>();
  const rows = document.createElement('style');
  let marking = false;

  const tree = new FileTree({
    paths: [],
    flattenEmptyDirectories: true,
    initialExpansion: 'open',
    density: 'compact',
    icons: 'minimal',
    // Siblings sort as `comparePaths` orders the diffs.
    sort: (left, right) =>
      left.isDirectory === right.isDirectory
        ? compareNames(left.basename, right.basename)
        : left.isDirectory
          ? -1
          : 1,
    unsafeCSS: ROW_CSS,
    onSelectionChange: (paths) => {
      const path = paths.at(-1);

      if (!marking && path && byPath.has(path)) onPick(path);
    },
  });

  tree.render({ containerWrapper: container });

  const root = tree.getFileTreeContainer()?.shadowRoot;

  if (root) {
    root.append(rows);
    describeRows(root, (path) => byPath.get(path));
  }

  return {
    show(files) {
      byPath.clear();

      for (const file of files) byPath.set(file.path, file);
      tree.resetPaths(files.map(({ path }) => path));
      tree.setGitStatus(files.map(({ path, status }) => ({ path, status })));
      rows.textContent = rowCss(files);
    },
    mark(path) {
      marking = true;

      for (const selected of tree.getSelectedPaths())
        if (selected !== path) tree.getItem(selected)?.deselect();

      tree.getItem(path)?.select();
      tree.scrollToPath(path, { focus: false, offset: 'nearest' });
      marking = false;
    },
  };
};
