import { Effect, Stream, SubscriptionRef } from 'effect';
import { UIRouter } from '@uirouter/core';
import { routeRef, snapshotRoute, type RouteSnapshot } from 'ui-router-effect';

const router = new UIRouter();

const ref: SubscriptionRef.SubscriptionRef<RouteSnapshot> = routeRef(router);

const now: RouteSnapshot = snapshotRoute(router);

export const inAdmin: boolean = now.includes('admin.**', { id: '1' });

export const names: Stream.Stream<string | undefined> = ref.changes.pipe(
  Stream.map((route) => route.current?.name),
  Stream.changes,
);

export const current: Effect.Effect<RouteSnapshot> = SubscriptionRef.get(ref);
