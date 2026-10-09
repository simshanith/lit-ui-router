import { Signal } from 'signal-polyfill';

/**
 * Watches `expression` through a `Signal.Computed` and hands every new value
 * to `apply`: once synchronously, then in a microtask after any source
 * changes. A value the computed's `equals` judges unchanged is skipped.
 *
 * @returns a function that stops watching.
 *
 * @internal
 */
export function watchSelection<T>(
  expression: () => T,
  equals: ((a: T, b: T) => boolean) | undefined,
  apply: (value: T) => void,
): () => void {
  const computed = new Signal.Computed(expression, { equals });
  let live = true;
  let pending = false;
  let last = computed.get();

  // notify runs inside the source's set(); reading signals there throws.
  const watcher = new Signal.subtle.Watcher(() => {
    if (pending) return;
    pending = true;
    queueMicrotask(() => {
      pending = false;
      if (!live) return;
      watcher.watch();
      const value = computed.get();
      if (Object.is(value, last)) return;
      last = value;
      apply(value);
    });
  });
  watcher.watch(computed);
  apply(last);

  return () => {
    live = false;
    watcher.unwatch(computed);
  };
}
