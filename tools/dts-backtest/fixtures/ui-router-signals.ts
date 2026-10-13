import { Signal } from 'signal-polyfill';
import { UIRouter } from '@uirouter/core';
import {
  RouterSignals,
  watchSelection,
  type RouteSnapshot,
} from 'ui-router-signals';

const signals: RouterSignals = RouterSignals.for(new UIRouter());

const route: Signal.Computed<RouteSnapshot> = signals.route;

export const inAdmin: boolean = route.get().includes('admin.**', { id: '1' });

export const stop: () => void = watchSelection(
  () => signals.current.get()?.name,
  (a, b) => a === b,
  (name: string | undefined) => void name,
);
