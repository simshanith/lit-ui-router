import type { TargetState, Transition, StateDeclaration } from '@uirouter/core';
import type { DSRFunction } from '@uirouter/dsr/lib/interface.js';

interface DsrStateDeclaration extends StateDeclaration {
  dsr?: {
    default?: string;
  };
}

interface DsrTransition extends Transition {
  to(): DsrStateDeclaration;
}

// upstream's declared DSRFunction return type omits the TargetState its runtime consumes
export const dsrRedirectToDefaultFromWithin = ((
  transition: DsrTransition,
  redirect: TargetState,
) => {
  const $state = transition.router.stateService;
  const toState = transition.to();
  const dsrDefault = toState.dsr?.default;
  if (
    dsrDefault &&
    $state.includes(toState, undefined, { relative: transition.from() })
  ) {
    return $state.target(dsrDefault);
  }
  return redirect;
}) as DSRFunction;

export default dsrRedirectToDefaultFromWithin;
