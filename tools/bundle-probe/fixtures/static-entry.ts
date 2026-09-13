// Violates a `free: ['rolldown']` claim: the external is on the static graph.
import { bundlerKind } from './uses-external.ts';

export const kind = bundlerKind;
