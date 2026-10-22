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

const summary = (files: readonly FileDiffMetadata[]): string => {
  const hunks = files.flatMap(({ hunks }) => hunks);
  const added = hunks.reduce((sum, hunk) => sum + hunk.additionLines, 0);
  const removed = hunks.reduce((sum, hunk) => sum + hunk.deletionLines, 0);

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

const render = async (host: HTMLElement): Promise<void> => {
  const { package: name = '', from = '', to = '' } = host.dataset;
  const status = host.querySelector<HTMLElement>('[role="status"]');
  const list = host.querySelector<HTMLElement>('.diff-files');

  if (!status || !list) return;

  try {
    const patch = await npmDiff(name, from, to);

    if (patch === '') {
      status.textContent = 'The two versions publish identical files.';

      return;
    }

    const files = parsePatchFiles(patch).flatMap((parsed) => parsed.files);

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

    status.replaceChildren(
      `${summary(files)} `,
      download(patch, `${name}-${from}...${to}.patch`),
    );

    for (const file of files) {
      const item = document.createElement('li');

      list.append(item);
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
        containerWrapper: item,
      });
    }
  } catch (error) {
    status.textContent = `The diff could not be built: ${error instanceof Error ? error.message : String(error)}.`;
  }
};

const host = document.querySelector<HTMLElement>('[data-npm-diff]');

if (host) await render(host);
