interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

// Every page is a staged file: the Worker runs so the request has a trace.
export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return env.ASSETS.fetch(request);
  },
};
