import type { TransitionOptions } from '@uirouter/core';

import type { Source } from './event-schema.ts';

// SAFETY: `source` is @internal in core 6.1.2 and is the only way to tell a URL sync from a go().
export const sourceOf = (options: TransitionOptions): Source =>
  (options as TransitionOptions & { source?: Source }).source ?? 'unknown';
