import { Rejection } from '@uirouter/core';

/** The message a rejected transition or failed resolve carries. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- a rejection reason, which core and the app type any
export const messageOf = (error: unknown): string => {
  const detail: unknown = error instanceof Rejection ? error.detail : error;

  if (detail instanceof Error) return detail.message;

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- hooks may reject with a bare string
  if (typeof detail === 'string') return detail;

  return error instanceof Rejection ? error.message : String(error);
};

/** The thrown Error's `name`, when a hook or resolve threw or rejected with an Error. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- a rejection reason, which core and the app type any
export const errorNameOf = (error: unknown): string | undefined => {
  const thrown: unknown = error instanceof Rejection ? error.detail : error;

  return thrown instanceof Error ? thrown.name : undefined;
};
