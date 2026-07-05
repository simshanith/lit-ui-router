import type { Transition, StateDeclaration } from '@uirouter/core';

interface DsrStateDeclaration extends StateDeclaration {
  dsr?: {
    default?: string;
  };
}

interface DsrTransition extends Transition {
  to(): DsrStateDeclaration;
}

export function dsrRedirectToDefaultFromWithin(
  transition: DsrTransition,
  redirect: string,
) {
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
}

export default dsrRedirectToDefaultFromWithin;
