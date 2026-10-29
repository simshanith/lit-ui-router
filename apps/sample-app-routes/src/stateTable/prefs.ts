// Dependency-free on its own `./state-table/prefs` subpath, so only the prefs chunk carries it.

/** The prefs module's states, which `app`'s `prefs.**` future state loads. */
export const prefsTable = [
  { name: 'prefs', parent: 'app', url: '/prefs' },
] as const;
