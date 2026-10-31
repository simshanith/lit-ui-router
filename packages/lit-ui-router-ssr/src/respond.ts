// A response state's answer: settle the router on it, then run the handler bound to its name with the landed resolves.
import type { Transition, UIRouter } from '@uirouter/core';
import type { Verdict } from 'ui-router-server';
import { settle } from 'ui-router-server/ssr';
import type {
  ResponseHandler,
  ResponseResolves,
  SettleOptions,
} from 'ui-router-server/ssr';

/**
 * Handlers bound by state name, as {@link responder} takes them. Type the
 * object with `ResponseHandlers` from `ui-router-server/ssr` to require a
 * handler for exactly the states the routes mark.
 */
export type BoundResponses = Readonly<Record<string, ResponseHandler<never>>>;

/** Answers one response verdict for the request it came from. */
export type Responder = (
  verdict: Extract<Verdict, { kind: 'response' }>,
  request: Request,
) => Promise<Response>;

/** Every string-keyed resolve the landed transition holds, inherited ones included. */
const resolvesOf = (transition: Transition): ResponseResolves =>
  Object.fromEntries(
    transition
      .getResolveTokens()
      .filter((token): token is string => typeof token === 'string')
      .map((token) => [token, transition.injector().get<unknown>(token)]),
  );

const searchOf = (url: string): string => {
  const cut = url.indexOf('?');

  if (cut === -1) return '';
  const hash = url.indexOf('#', cut);

  return hash === -1 ? url.slice(cut) : url.slice(cut, hash);
};

/**
 * Answers response verdicts on `router`: settles it on the verdict's subpath,
 * the request's query included, and runs the handler bound to the state it
 * lands on with that transition's resolves and the request. The `Response`
 * goes out as the handler built it; a HEAD gets it without its body.
 *
 * It fits the fetch adapter's `serveResponse` bare:
 * `serveResponse: responder(router, responses)`.
 *
 * @param router - the server router, its location installed with `installServerLocation` for the verdict's mount
 * @param responses - the handlers, keyed by response state name
 * @param options - passed to `settle`
 * @returns the responder; its promise rejects as `settle` does, so a resolve that throws fails the request before any handler runs
 * @throws from the responder, an `Error` when the landed state has no handler in `responses`
 *
 * @example
 * ```ts
 * const responses = {
 *   badge: ({ resolves }) =>
 *     new Response(resolves.svg, { headers: { 'Content-Type': 'image/svg+xml' } }),
 * } satisfies ResponseHandlers<(typeof routes)[number], { badge: { svg: string } }>;
 *
 * const handler = createFetchHandler(router, {
 *   serveShell,
 *   serveResponse: (verdict, request) => responder(pageRouter(), responses)(verdict, request),
 * });
 * ```
 */
export function responder(
  router: UIRouter,
  responses: BoundResponses,
  options?: SettleOptions,
): Responder {
  return async (verdict, request) => {
    const transition = await settle(
      router,
      verdict.subpath + searchOf(request.url),
      options,
    );

    const state = transition.$to().name;

    if (!Object.hasOwn(responses, state))
      throw new Error(
        `responder: the landed state '${state}' has no handler in responses`,
      );

    // SAFETY: each handler reads the resolves its own state declares, which the landed transition carries.
    const handler = responses[state] as ResponseHandler;

    const response = await handler({
      resolves: resolvesOf(transition),
      request,
    });

    return request.method === 'HEAD'
      ? new Response(null, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        })
      : response;
  };
}
