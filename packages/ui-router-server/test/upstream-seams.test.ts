import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, it } from 'node:test';

import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite';

import type {
  ConnectMiddleware,
  ConnectRequest,
  ConnectResponse,
} from '../src/connect.ts';
import type { ServerRouterPlugin, ViteMiddlewareServer } from '../src/vite.ts';

// The connect/vite adapters keep HAND-WRITTEN structural host contracts on
// purpose: ./connect and ./vite export no upstream node/vite types and drag in
// no runtime or peer dependency (the fetch/timer globals come from @types/node,
// these host shapes stay self-contained — see connect.ts / vite.ts). But a
// structural subset is only correct if it still MATCHES upstream where real
// objects cross the seam. This file drift-guards that match at typecheck time:
// `vite` and `@types/node` are dev-only, imported `import type` (erased, so
// nothing ships and there's no test-runtime dep), and a diverged seam fails
// `typecheck:tests`. Pure type-level — the runtime array is a plain [true × 6].

// `true` iff From is assignable to To — tuple-wrapped so unions don't
// distribute, honoring the same assignability the runtime relies on at a seam.
type AssignableTo<From, To> = [From] extends [To] ? true : false;

// A diverged seam makes its slot's TYPE `false`, so the `true` initializer at
// that position fails to compile ("Type 'true' is not assignable to 'false'").
const seams: [
  // ./connect — a Connect stack (Express/Koa/Fastify/Vite, all on node:http)
  // hands the middleware real req/res, so each must satisfy the structural
  // param the middleware declares...
  AssignableTo<IncomingMessage, ConnectRequest>,
  AssignableTo<ServerResponse, ConnectResponse>,
  // ...and the middleware must slot into Connect's `use()` — exactly what the
  // vite plugin does with `server.middlewares.use(middleware)`.
  AssignableTo<ConnectMiddleware, Connect.NextHandleFunction>,
  // ./vite — the plugin must spread into `plugins: [...]`, and Vite hands the
  // real dev/preview servers to the hooks typed against the structural
  // middleware-server, so both real servers must satisfy it.
  AssignableTo<ServerRouterPlugin, Plugin>,
  AssignableTo<ViteDevServer, ViteMiddlewareServer>,
  AssignableTo<PreviewServer, ViteMiddlewareServer>,
] = [true, true, true, true, true, true];

describe('structural host contracts', () => {
  it('match upstream node:http and vite types at the seams', () => {
    // The proof is the tuple's element types above (enforced by
    // typecheck:tests); this only marks the file as exercised.
    assert.deepEqual(seams, [true, true, true, true, true, true]);
  });
});
