// The diff page's client: fetches both tarballs, prints npm diff's patch and renders it with @pierre/diffs.
import {
  type FileDiffMetadata,
  FileDiff,
  getFiletypeFromFileName,
  parsePatchFiles,
  setLanguageOverride,
  type SupportedLanguages,
} from '@pierre/diffs';
import { getOrCreateWorkerPoolSingleton } from '@pierre/diffs/worker';
import DiffsWorker from '@pierre/diffs/worker/worker.js?worker';

import type { DiffTree, TreeFile } from './release-diff-tree.ts';
import {
  comparePaths,
  FILE_FILTERS,
  type FileFilter,
  FILTER_LABELS,
  filterCounts,
  filterOf,
  matchesFilter,
  urlWithFilter,
} from './npm-diff/file-filter.ts';
import { LANGUAGES } from './npm-diff/languages.ts';
import { npmDiff } from './npm-diff/registry.ts';

const THEME = {
  light: 'github-light-high-contrast',
  dark: 'github-dark-high-contrast',
} as const;

// The themes' diff colors fall under 4.5:1 for these; primer's AA greens, reds and grays replace them.
const CONTRAST_CSS = `
[data-additions-count] { color: light-dark(#116329, #56d364); }
[data-deletions-count] { color: light-dark(#a40e26, #ff7b72); }
[data-unmodified-lines], [data-no-newline] > span { color: light-dark(#59636e, #c9d1d9); opacity: 1; }
`;

/** The width at which the tree moves beside the diffs, as `release-pages.css` declares it. */
const WIDE = '(min-width: 60rem)';

/** Each code column scrolls sideways, so a keyboard has to reach it. */
const focusScrollers = (node: HTMLElement): void => {
  for (const code of node.shadowRoot?.querySelectorAll<HTMLElement>(
    '[data-code]',
  ) ?? [])
    code.tabIndex = 0;
};

const highlighted = new Set<string>(LANGUAGES);

/** Source maps are one long line each; highlighting them buys nothing. */
const languageOf = (file: FileDiffMetadata): SupportedLanguages => {
  const lang = getFiletypeFromFileName(file.name);

  return !file.name.endsWith('.map') && highlighted.has(lang) ? lang : 'text';
};

const count = (n: number, noun: string): string =>
  `${n.toLocaleString('en')} ${noun}${n === 1 ? '' : 's'}`;

const linesOf = (file: FileDiffMetadata) => ({
  added: file.hunks.reduce((sum, hunk) => sum + hunk.additionLines, 0),
  removed: file.hunks.reduce((sum, hunk) => sum + hunk.deletionLines, 0),
});

const summary = (files: readonly FileDiffMetadata[]): string => {
  const lines = files.map(linesOf);
  const added = lines.reduce((sum, file) => sum + file.added, 0);
  const removed = lines.reduce((sum, file) => sum + file.removed, 0);

  return `${count(files.length, 'file')} changed, ${count(added, 'line')} added, ${count(removed, 'line')} removed.`;
};

const download = (patch: string, filename: string): HTMLAnchorElement => {
  const link = document.createElement('a');

  link.href = URL.createObjectURL(
    new Blob([`${patch}\n`], { type: 'text/x-diff' }),
  );
  link.download = filename;
  link.textContent = 'Download the patch';

  return link;
};

const STATUS: Readonly<Record<FileDiffMetadata['type'], TreeFile['status']>> = {
  change: 'modified',
  new: 'added',
  deleted: 'deleted',
  'rename-pure': 'renamed',
  'rename-changed': 'renamed',
};

const treeFileOf = (file: FileDiffMetadata): TreeFile => ({
  path: file.name,
  status: STATUS[file.type],
  ...linesOf(file),
});

/** One radio per preset, labelled with how many changed files it shows. */
const filterControl = (
  fieldset: HTMLFieldSetElement,
  counts: Readonly<Record<FileFilter, number>>,
  onChange: (filter: FileFilter) => void,
): ((filter: FileFilter) => void) => {
  const inputs = FILE_FILTERS.map((filter) => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    const tally = document.createElement('span');

    input.type = 'radio';
    input.name = 'files';
    input.value = filter;
    input.disabled = counts[filter] === 0;
    input.addEventListener('change', () => onChange(filter));
    tally.className = 'tally';
    tally.textContent = counts[filter].toLocaleString('en');
    label.append(input, `${FILTER_LABELS[filter]} `, tally);
    fieldset.append(label);

    return input;
  });

  fieldset.hidden = false;

  return (filter) => {
    for (const input of inputs) input.checked = input.value === filter;
  };
};

const prefersMotion = (): boolean =>
  matchMedia('(prefers-reduced-motion: no-preference)').matches;

/** The page's server-rendered parts the client fills in. */
interface Parts {
  status: HTMLElement;
  note: HTMLElement;
  fieldset: HTMLFieldSetElement;
  nav: HTMLElement;
  toggle: HTMLButtonElement;
  treeHost: HTMLElement;
  list: HTMLElement;
}

const partsOf = (host: HTMLElement): Parts | null => {
  const parts = {
    status: host.querySelector<HTMLElement>('.diff-status'),
    note: host.querySelector<HTMLElement>('.diff-note'),
    fieldset: host.querySelector<HTMLFieldSetElement>('.diff-filter'),
    nav: host.querySelector<HTMLElement>('.diff-nav'),
    toggle: host.querySelector<HTMLButtonElement>('.diff-nav-toggle'),
    treeHost: host.querySelector<HTMLElement>('.diff-tree'),
    list: host.querySelector<HTMLElement>('.diff-files'),
  };

  // SAFETY: checked just here that every part is present.
  return Object.values(parts).every(Boolean) ? (parts as Parts) : null;
};

/** One empty, hidden list item per file, keyed by path; a file's diff renders into it once it's first shown. */
const listItems = (
  list: HTMLElement,
  files: readonly FileDiffMetadata[],
): Map<string, HTMLLIElement> =>
  new Map(
    files.map((file) => {
      const item = document.createElement('li');

      item.id = `file-${file.name}`;
      item.tabIndex = -1;
      item.hidden = true;
      item.dataset.path = file.name;
      list.append(item);

      return [file.name, item];
    }),
  );

/** Renders a file's diff into its item, the first time it's asked to. */
const diffRenderer = (
  items: ReadonlyMap<string, HTMLLIElement>,
): ((file: FileDiffMetadata) => void) => {
  const pool = getOrCreateWorkerPoolSingleton({
    poolOptions: {
      workerFactory: () => new DiffsWorker(),
      poolSize: Math.min(4, navigator.hardwareConcurrency || 2),
    },
    highlighterOptions: { theme: THEME, langs: [...LANGUAGES] },
  });

  const themeType = document.documentElement.classList.contains('dark')
    ? 'dark'
    : 'light';

  const rendered = new Set<string>();

  return (file) => {
    if (rendered.has(file.name)) return;
    rendered.add(file.name);
    new FileDiff(
      {
        theme: THEME,
        themeType,
        diffStyle: 'unified',
        overflow: 'scroll',
        hunkSeparators: 'line-info',
        unsafeCSS: CONTRAST_CSS,
        onPostRender: focusScrollers,
      },
      pool,
    ).render({
      fileDiff: setLanguageOverride(file, languageOf(file)),
      containerWrapper: items.get(file.name),
    });
  };
};

/** Scrolls to a file's diff and focuses it, closing the narrow layout's tree. */
const picker =
  (items: ReadonlyMap<string, HTMLLIElement>, toggle: HTMLButtonElement) =>
  (path: string): void => {
    const item = items.get(path);

    if (!item) return;

    if (!matchMedia(WIDE).matches)
      toggle.setAttribute('aria-expanded', 'false');
    item.scrollIntoView({
      behavior: prefersMotion() ? 'smooth' : 'auto',
      block: 'start',
    });
    // The tree refocuses its row after the selection settles.
    setTimeout(() => item.focus({ preventScroll: true }));
  };

/** Marks in `tree` the shown file crossing the top fifth of the viewport. */
const spyOn = (
  items: ReadonlyMap<string, HTMLLIElement>,
  tree: DiffTree,
): void => {
  const inView = new Set<Element>();

  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) inView.add(entry.target);
        else inView.delete(entry.target);

      const first = [...items.values()].find((item) => inView.has(item));

      if (first?.dataset.path) tree.mark(first.dataset.path);
    },
    { rootMargin: '0px 0px -80% 0px' },
  );

  for (const item of items.values()) spy.observe(item);
};

/** The file tree beside the diffs; without it, the diffs still read top to bottom. */
const mountTree = async (
  treeModule: Promise<typeof import('./release-diff-tree.ts')>,
  parts: Parts,
  items: ReadonlyMap<string, HTMLLIElement>,
  shown: () => readonly FileDiffMetadata[],
): Promise<DiffTree | undefined> => {
  const { nav, toggle, treeHost } = parts;

  try {
    const { mountDiffTree } = await treeModule;
    const tree = mountDiffTree(treeHost, picker(items, toggle));

    toggle.addEventListener('click', () =>
      toggle.setAttribute(
        'aria-expanded',
        String(toggle.getAttribute('aria-expanded') !== 'true'),
      ),
    );
    tree.show(shown().map(treeFileOf));
    nav.hidden = false;
    spyOn(items, tree);

    return tree;
  } catch {
    return undefined;
  }
};

/** The files the current preset shows, and the tree once it has loaded. */
interface ViewState {
  shown: readonly FileDiffMetadata[];
  tree?: DiffTree;
}

const render = async (host: HTMLElement): Promise<void> => {
  const { package: name = '', from = '', to = '' } = host.dataset;
  const parts = partsOf(host);

  if (!parts) return;

  const { status, note, fieldset, toggle, list } = parts;
  // Fetched beside the tarballs; a failure leaves the page without a tree.
  const treeModule = import('./release-diff-tree.ts');

  treeModule.catch(() => {});

  let patch: string;

  try {
    patch = await npmDiff(name, from, to);
  } catch (error) {
    status.textContent = `The diff could not be built: ${error instanceof Error ? error.message : String(error)}.`;

    return;
  }

  if (patch === '') {
    status.textContent = 'The two versions publish identical files.';

    return;
  }

  const files = parsePatchFiles(patch)
    .flatMap((parsed) => parsed.files)
    .sort((a, b) => comparePaths(a.name, b.name));

  status.replaceChildren(
    `${summary(files)} `,
    download(patch, `${name}-${from}...${to}.patch`),
  );

  const items = listItems(list, files);
  const renderDiff = diffRenderer(items);
  const counts = filterCounts(files.map((file) => file.name));

  const view: ViewState = { shown: [] };

  /** Shows `requested`'s files, or every file when it matches none, and returns the preset shown. */
  const apply = (requested: FileFilter): FileFilter => {
    const filter = counts[requested] === 0 ? 'all' : requested;

    note.textContent =
      filter === requested
        ? ''
        : `${FILTER_LABELS[requested]} matches none of the changed files, so All shows.`;
    view.shown = files.filter((file) => matchesFilter(filter, file.name));

    for (const [path, item] of items)
      item.hidden = !view.shown.some((file) => file.name === path);

    for (const file of view.shown) renderDiff(file);
    view.tree?.show(view.shown.map(treeFileOf));
    toggle.textContent = `Files (${view.shown.length.toLocaleString('en')})`;

    return filter;
  };

  const check = filterControl(fieldset, counts, (filter) => {
    check(apply(filter));
    history.replaceState(
      history.state,
      '',
      urlWithFilter(location.href, filter),
    );
  });

  check(apply(filterOf(location.search)));
  view.tree = await mountTree(treeModule, parts, items, () => view.shown);
};

const host = document.querySelector<HTMLElement>('[data-npm-diff]');

if (host) await render(host);
