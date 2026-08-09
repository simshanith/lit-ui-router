import type {
  LocationConfig,
  LocationPlugin,
  LocationServices,
  PluginFactory,
  UIRouterPlugin,
} from '@uirouter/core';

import { navigationLocationPlugin } from '../index.js';

// The upstream contract the plugin must keep with @uirouter/core: it has to be
// a thing `router.plugin()` accepts, and what it hands back has to be a
// LocationPlugin (a UIRouterPlugin that carries the location services the
// urlService drives). Type-level only — the `.types.ts` name keeps this out of
// vitest's `src/specs/**/*.spec.ts` glob, and out of `typecheck:src` (which
// excludes src/specs); the package `typecheck` compile IS the assertion.
//
// This replaces the runtime shape assertions the browser suite used to carry
// (`typeof navigationLocationPlugin === 'function'`, `expect(plugin).toBeDefined()`,
// and a `router.urlService` check that was true of a bare UIRouter with no
// plugin at all). Each cost three browser engines to decide something the
// compiler already knows — and none of them pinned the core seam this does.
// The behaviour half (the plugin's name, and that it actually drives
// window.navigation) stays in index.spec.ts / url-shape.spec.ts.

// `true` iff From is assignable to To — tuple-wrapped so unions don't distribute.
type AssignableTo<From, To> = [From] extends [To] ? true : false;

// A diverged seam makes its slot's TYPE `false`, so the `true` initializer at
// that position fails to compile ("Type 'true' is not assignable to 'false'").
export const seams: [
  // router.plugin(navigationLocationPlugin) — the documented installation path.
  AssignableTo<typeof navigationLocationPlugin, PluginFactory<LocationPlugin>>,
  // ...and what it returns is a plugin core will accept and read services off.
  AssignableTo<ReturnType<typeof navigationLocationPlugin>, LocationPlugin>,
  AssignableTo<LocationPlugin, UIRouterPlugin>,
  AssignableTo<LocationPlugin['service'], LocationServices>,
  AssignableTo<LocationPlugin['configuration'], LocationConfig>,
] = [true, true, true, true, true];
