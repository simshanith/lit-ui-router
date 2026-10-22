// The diff page's client: fetches the pair's index, then the shown preset's patch sections, and renders them with @pierre/diffs.
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

import type { DiffFile, DiffIndex } from './diff-data.ts';
import type { DiffTree, TreeFile } from './release-diff-tree.ts';
import {
  comparePaths,
  FILE_FILTERS,
  type FileFilter,
  FILTER_LABELS,
  filterCounts,
  filterOf,
  shows,
  urlWithFilter,
} from './npm-diff/file-filter.ts';
import { LANGUAGES } from './npm-diff/languages.ts';

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

const summary = (files: readonly DiffFile[]): string => {
  const added = files.reduce((sum, file) => sum + file.added, 0);
  const removed = files.reduce((sum, file) => sum + file.removed, 0);

  return `${count(files.length, 'file')} changed, ${count(added, 'line')} added, ${count(removed, 'line')} removed.`;
};

/** The page's data routes sit below its own, slashed url. */
const dataUrl = (path: string): URL => new URL(path, location.href);

const fetched = async (url: URL): Promise<Response> => {
  const response = await fetch(url);

  if (!response.ok)
    throw new Error(`${url.pathname} answered ${response.status}`);

  return response;
};

const indexOf = async (): Promise<DiffIndex> =>
  // SAFETY: the worker serves the index the release-diffs worker returns.
  (await (await fetched(dataUrl('index.json'))).json()) as DiffIndex;

/** The files a preset shows, parsed from the patch sections the worker serves for it. */
const presetFiles = async (filter: FileFilter): Promise<FileDiffMetadata[]> =>
  parsePatchFiles(
    await (await fetched(dataUrl(`files/${filter}`))).text(),
  ).flatMap((parsed) => parsed.files);

const download = (filename: string): HTMLAnchorElement => {
  const link = document.createElement('a');

  link.href = dataUrl('patch').href;
  link.download = filename;
  link.textContent = 'Download the patch';

  return link;
};

const treeFileOf = ({ path, kind, added, removed }: DiffFile): TreeFile => ({
  path,
  status: kind,
  added,
  removed,
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
  files: readonly DiffFile[],
): Map<string, HTMLLIElement> =>
  new Map(
    files.map(({ path }) => {
      const item = document.createElement('li');

      item.id = `file-${path}`;
      item.tabIndex = -1;
      item.hidden = true;
      item.dataset.path = path;
      list.append(item);

      return [path, item];
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
  shown: () => readonly DiffFile[],
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

/** The preset shown, its files, and the tree once it has loaded. */
interface ViewState {
  filter?: FileFilter;
  shown: readonly DiffFile[];
  tree?: DiffTree;
}

/** Each preset's files, fetched the first time it shows; a preset whose files another already fetched skips the fetch. */
const presetLoader = () => {
  const loaded = new Map<string, FileDiffMetadata>();
  const loading = new Map<FileFilter, Promise<void>>();

  return async (
    filter: FileFilter,
    shown: readonly DiffFile[],
  ): Promise<FileDiffMetadata[]> => {
    if (!shown.every(({ path }) => loaded.has(path))) {
      const pending =
        loading.get(filter) ??
        presetFiles(filter).then((files) => {
          for (const file of files) loaded.set(file.name, file);
        });

      loading.set(filter, pending);
      await pending;
    }

    return shown.flatMap(({ path }) => loaded.get(path) ?? []);
  };
};

const render = async (host: HTMLElement): Promise<void> => {
  const { package: name = '', from = '', to = '' } = host.dataset;
  const parts = partsOf(host);

  if (!parts) return;

  const { status, note, fieldset, toggle, list } = parts;
  // Fetched beside the index; a failure leaves the page without a tree.
  const treeModule = import('./release-diff-tree.ts');

  treeModule.catch(() => {});

  let index: DiffIndex;

  try {
    index = await indexOf();
  } catch (error) {
    status.textContent = `The diff could not be built: ${error instanceof Error ? error.message : String(error)}.`;

    return;
  }

  if (index.files.length === 0) {
    status.textContent = 'The two versions publish identical files.';

    return;
  }

  const files = [...index.files].sort((a, b) => comparePaths(a.path, b.path));

  status.replaceChildren(
    `${summary(files)} `,
    download(`${name.replace('/', '-')}-${from}...${to}.patch`),
  );

  const items = listItems(list, files);
  const renderDiff = diffRenderer(items);
  const load = presetLoader();
  const counts = filterCounts(files);

  const view: ViewState = { shown: [] };

  /** Renders the shown preset's diffs once its files arrive. */
  const fill = async (filter: FileFilter): Promise<void> => {
    try {
      const loaded = await load(filter, view.shown);

      if (view.filter === filter) for (const file of loaded) renderDiff(file);
    } catch (error) {
      if (view.filter === filter)
        note.textContent = `The files could not be loaded: ${error instanceof Error ? error.message : String(error)}.`;
    }
  };

  /** Shows `requested`'s files, or every file when it matches none, and returns the preset shown. */
  const apply = (requested: FileFilter): FileFilter => {
    const filter = counts[requested] === 0 ? 'all' : requested;

    note.textContent =
      filter === requested
        ? ''
        : `${FILTER_LABELS[requested]} matches none of the changed files, so All shows.`;
    view.filter = filter;
    view.shown = files.filter((file) => shows(filter, file));

    const shownPaths = new Set(view.shown.map(({ path }) => path));

    for (const [path, item] of items) item.hidden = !shownPaths.has(path);

    void fill(filter);
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
