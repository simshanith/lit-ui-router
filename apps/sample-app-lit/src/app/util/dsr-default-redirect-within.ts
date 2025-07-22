export function dsrRedirectToDefaultFromWithin(transition, redirect) {
  const $state = transition.router.stateService;
  if ($state.includes(transition.to(), null, { relative: transition.from() })) {
    return $state.target(transition.to().dsr.default);
  }
  return redirect;
}

export default dsrRedirectToDefaultFromWithin;
