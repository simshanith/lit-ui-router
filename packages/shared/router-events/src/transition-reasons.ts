import { Rejection } from '@uirouter/core';

import type { Outcome } from './event-schema.ts';

const seq = (id: number): string => String(id).padStart(3, '0');

export const ignoredReason =
  'Same state and params; pass reload: true to run it again';

export const abortedReason = 'Aborted by a hook';

export const supersededReason = (by: number | null): string =>
  by === null ? 'Superseded by a newer transition' : `Superseded by ${seq(by)}`;

export const redirectedReason = (to: number | null): string =>
  to === null ? 'Redirected' : `Redirected to ${seq(to)}`;

export const invalidTargetReason = (name: string): string =>
  `No state named '${name}'`;

export const invalidTransitionReason = (detail: string): string =>
  `Invalid transition: ${detail}`;

export const errorReason = (message: string): string =>
  message || 'A hook or resolve threw';

export interface ReasonInput {
  outcome: Outcome;
  message: string;
  by: number | null;
}

export const reasonFor = ({
  outcome,
  message,
  by,
}: ReasonInput): string | null => {
  switch (outcome) {
    case 'success':
      return null;
    case 'ignored':
      return ignoredReason;
    case 'redirected':
      return redirectedReason(by);
    case 'superseded':
      return supersededReason(by);
    case 'aborted':
      return abortedReason;
    case 'invalid':
      return invalidTransitionReason(message);
    default:
      return errorReason(message);
  }
};

/** The message a rejected transition or failed resolve carries. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- a rejection reason, which core and the app type any
export const messageOf = (error: unknown): string => {
  const detail: unknown = error instanceof Rejection ? error.detail : error;

  if (detail instanceof Error) return detail.message;

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- hooks may reject with a bare string
  if (typeof detail === 'string') return detail;

  return error instanceof Rejection ? error.message : String(error);
};
