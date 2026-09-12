import { Layer, ManagedRuntime } from 'effect';

/**
 * The one runtime every Effect in this app runs on.
 *
 * The app declares no services yet, so the layer is empty; a real app would
 * build its services here and everything below would keep running unchanged
 * (`runtime.runSync`, `runtime.runFork`, `runtime.runPromise`).
 *
 * Module scope, not per-component: forked subscriptions and the app stores
 * outlive any single element, and one runtime keeps their fibers on one
 * scheduler.
 */
export const runtime = ManagedRuntime.make(Layer.empty);
