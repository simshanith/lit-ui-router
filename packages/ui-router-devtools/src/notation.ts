import type { Tx } from './fold.ts';
import type { Outcome, ParamValue } from './schema.ts';

export type Status = Outcome | 'running';

export const seq = (id: number): string =>
  id < 0 ? '' : String(id).padStart(3, '0');

export const ms = (value: number): string => {
  if (value >= 1000) return `${(value / 1000).toFixed(1)} s`;

  if (value < 10) return `${value.toFixed(1)} ms`;

  return `${Math.round(value)} ms`;
};

export const segment = (name: string): string => {
  const bare = name.endsWith('.**') ? name.slice(0, -3) : name;

  return bare.slice(bare.lastIndexOf('.') + 1);
};

export const relative = (name: string, base: string | undefined): string =>
  base && name.startsWith(`${base}.`) ? name.slice(base.length + 1) : name;

export interface PathParts {
  pivot: string | undefined;
  exited: string | undefined;
  entered: string | undefined;
}

// The row notation: retained pivot, then the deepest exited and entered states relative to it.
export const pathParts = (tx: Tx): PathParts => {
  const pivot = tx.retained.at(-1);
  // The adapter records all three paths root first, as core's treeChanges() holds them.
  const exited = tx.exiting.at(-1);
  const entered = tx.entering.at(-1);

  return {
    pivot,
    exited: exited && relative(exited, pivot),
    entered: entered && relative(entered, pivot),
  };
};

export const statusText: Record<Status, string> = {
  running: '◌',
  success: '✓',
  error: '■',
  invalid: '▲',
  redirected: '↳',
  superseded: '»',
  aborted: '⊘',
  ignored: '–',
};

export const pathText = (tx: Tx): string => {
  if (tx.id < 0) return tx.to;
  const { pivot, exited, entered } = pathParts(tx);

  return [pivot, exited && `− ${exited}`, entered && `+ ${entered}`]
    .filter(Boolean)
    .join(' ');
};

// Tags shown only when a transition is not a plain link or go().
export const sourceTags = (tx: Tx): string[] => {
  if (tx.id < 0) return [];
  const { source, location, reload } = tx.options;

  return [
    source === 'url' && 'URL',
    source === 'otherwise' && 'Otherwise',
    location === 'replace' && source !== 'redirect' && 'Replace',
    location === false && 'No URL',
    reload !== false && 'Reload',
    tx.dynamic && 'Dynamic',
  ].filter((tag): tag is string => Boolean(tag));
};

export interface ResultText {
  head: string;
  detail?: string;
}

const plural = (count: number, word: string) =>
  count === 1 ? word : `${word}s`;

const invalidText = ({ to, id, result }: Tx): ResultText => {
  if (id < 0) return { head: `No state named '${to}'` };
  const params = result?.invalidParams ?? [];
  const message = result?.message;

  const head = params.length
    ? `Invalid ${plural(params.length, 'param')}: ${params.join(', ')}`
    : 'Invalid transition';

  return message ? { head, detail: message } : { head };
};

const errorText = ({ result }: Tx): ResultText => {
  const message = result?.message;
  const name = result?.errorName;

  if (!message)
    return { head: name ? `${name} thrown` : 'A hook or resolve threw' };

  return name && name !== 'Error'
    ? { head: message, detail: name }
    : { head: message };
};

// The words for how a transition ended, derived from the result's fields; success and running have none.
export const resultText = (tx: Tx): ResultText | null => {
  const result = tx.result;
  const by = result?.by;

  switch (result?.outcome) {
    case 'ignored':
      return {
        head: 'Same state and params; pass reload: true to run it again',
      };
    case 'redirected':
      return {
        head: by === undefined ? 'Redirected' : `Redirected to ${seq(by)}`,
      };
    case 'superseded':
      return {
        head:
          by === undefined
            ? 'Superseded by a newer transition'
            : `Superseded by ${seq(by)}`,
      };
    case 'aborted':
      return result.message
        ? { head: 'Aborted', detail: result.message }
        : { head: 'Aborted' };
    case 'invalid':
      return invalidText(tx);
    case 'error':
      return errorText(tx);
    default:
      return null;
  }
};

/** The result text on one line, for the console, the Performance panel and the live region. */
export const resultLine = (tx: Tx): string => {
  const text = resultText(tx);

  return text ? [text.head, text.detail].filter(Boolean).join(': ') : '';
};

/** A recorded param value as text; null and a missing value are both empty. */
export const paramText = (value: ParamValue | undefined): string => {
  if (value === undefined || value === null) return '';

  return Array.isArray(value)
    ? `[${value.map((item) => JSON.stringify(item)).join(', ')}]`
    : String(value);
};

export const sameParam = (
  a: ParamValue | undefined,
  b: ParamValue | undefined,
): boolean => a === b || JSON.stringify(a) === JSON.stringify(b);

const SEGMENT_MAX = 24;

// Shortens a long name segment in the middle; both ends carry meaning.
export const truncateMiddle = (
  text: string,
  max: number = SEGMENT_MAX,
): string => {
  if (text.length <= max) return text;

  const keep = max - 1;
  const lead = Math.ceil(keep / 2);

  return `${text.slice(0, lead)}…${text.slice(text.length - (keep - lead))}`;
};
