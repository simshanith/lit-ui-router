import {
  abortedReason,
  errorReason,
  ignoredReason,
  invalidTargetReason,
  invalidTransitionReason,
  redirectedReason,
  supersededReason,
} from '@repo/router-events/reasons';

interface Reasons {
  readonly ignored: typeof ignoredReason;
  readonly superseded: typeof supersededReason;
  readonly redirected: typeof redirectedReason;
  readonly aborted: typeof abortedReason;
  readonly invalidTarget: typeof invalidTargetReason;
  readonly invalidTransition: typeof invalidTransitionReason;
  readonly error: typeof errorReason;
}

export const reasons: Reasons = {
  ignored: ignoredReason,
  superseded: supersededReason,
  redirected: redirectedReason,
  aborted: abortedReason,
  invalidTarget: invalidTargetReason,
  invalidTransition: invalidTransitionReason,
  error: errorReason,
};
