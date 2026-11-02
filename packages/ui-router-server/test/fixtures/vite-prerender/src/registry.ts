// A preload standing in for a DOM shim: it installs a registry global the app defines into.
Object.assign(globalThis, { fixtureRegistry: new Set<string>() });
