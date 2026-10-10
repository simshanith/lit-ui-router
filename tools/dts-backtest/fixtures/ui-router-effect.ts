import { Effect, SubscriptionRef } from 'effect';
import { UIRouter } from '@uirouter/core';
import { routeRef, snapshotRoute, type RouteSnapshot } from 'ui-router-effect';

const router = new UIRouter();

const ref: SubscriptionRef.SubscriptionRef<RouteSnapshot> = routeRef(router);

const now: RouteSnapshot = snapshotRoute(router);

export const inAdmin: boolean = now.includes('admin.**', { id: '1' });

export const current: Effect.Effect<RouteSnapshot> = SubscriptionRef.get(ref);

export const name: Effect.Effect<string | undefined> = current.pipe(
  Effect.map((route) => route.current?.name),
);
