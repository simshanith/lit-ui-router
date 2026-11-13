import { Rejection } from '@uirouter/core';

import type { Outcome } from './schema.ts';

const seq = (id: number): string => String(id).padStart(3, '0');

export const reasons = {
  ignored: 'Same state and params; pass reload: true to run it again',
  superseded: (by: number | null): string =>
    by === null
      ? 'Superseded by a newer transition'
      : `Superseded by ${seq(by)}`,
  redirected: (to: number | null): string =>
    to === null ? 'Redirected' : `Redirected to ${seq(to)}`,
  aborted: 'Aborted by a hook',
  invalidTarget: (name: string): string => `No state named '${name}'`,
  invalidTransition: (detail: string): string =>
    `Invalid transition: ${detail}`,
  error: (message: string): string => message || 'A hook or resolve threw',
} as const;

export interface ReasonInput {
  outcome: Outcome;
  message: string;
  successor: number | null;
  supersededBy: number | null;
}

const reasonByOutcome: Record<Outcome, (input: ReasonInput) => string | null> =
  {
    success: () => null,
    ignored: () => reasons.ignored,
    redirected: ({ successor }) => reasons.redirected(successor),
    superseded: ({ supersededBy }) => reasons.superseded(supersededBy),
    aborted: () => reasons.aborted,
    invalid: ({ message }) => reasons.invalidTransition(message),
    error: ({ message }) => reasons.error(message),
  };

export const reasonFor = (input: ReasonInput): string | null =>
  reasonByOutcome[input.outcome](input);

/** The message a rejected transition or failed resolve carries. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- a rejection reason, which core and the app type any
export const messageOf = (error: unknown): string => {
  const detail: unknown = error instanceof Rejection ? error.detail : error;

  if (detail instanceof Error) return detail.message;

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- hooks may reject with a bare string
  if (typeof detail === 'string') return detail;

  return error instanceof Rejection ? error.message : String(error);
};
