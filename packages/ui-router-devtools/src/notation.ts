import type { Tx } from './fold.ts';
import type { Outcome } from './schema.ts';

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
