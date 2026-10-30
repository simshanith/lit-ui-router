// The two boot paths the harness compares: the served document, and the same document with its prerendered markup stripped.

/** `prerendered`: `bootstrap()` adopts the served page. `cold`: it finds nothing to adopt and renders. */
export type BootPath = 'prerendered' | 'cold';

export const BOOT_PATHS: readonly BootPath[] = ['prerendered', 'cold'];

const DRAWN_ROOT = /<div id="root">[\s\S]*<\/div>(\s*<\/body>)/;

/** The served document with `#root` emptied, as vite built it before the prerender drew into it. */
export const coldDocument = (html: string): string => {
  if (!DRAWN_ROOT.test(html)) {
    throw new Error('the served document has no drawn #root to strip');
  }

  return html.replace(DRAWN_ROOT, '<div id="root"></div>$1');
};

/** CDP `Fetch` patterns that pause the page's document once its response has come over the throttled network. */
export const DOCUMENT_PATTERNS = [
  {
    urlPattern: '*/domain-search*',
    resourceType: 'Document',
    requestStage: 'Response',
  },
] as const;

interface PausedResponse {
  requestId: string;
  responseStatusCode?: number;
  responseHeaders?: { name: string; value: string }[];
}

interface ResponseBody {
  body: string;
  base64Encoded: boolean;
}

// The body arrives decoded, so its encoding and length headers no longer describe it.
const STALE_HEADERS = new Set(['content-encoding', 'content-length']);

/** `Fetch.fulfillRequest` params serving `path`'s document; both paths are fulfilled, so they pay the same. */
export const fulfillDocument = (
  path: BootPath,
  paused: PausedResponse,
  { body, base64Encoded }: ResponseBody,
) => {
  const html = base64Encoded
    ? Buffer.from(body, 'base64').toString('utf8')
    : body;

  return {
    requestId: paused.requestId,
    responseCode: paused.responseStatusCode ?? 200,
    responseHeaders: (paused.responseHeaders ?? []).filter(
      ({ name }) => !STALE_HEADERS.has(name.toLowerCase()),
    ),
    body: Buffer.from(
      path === 'cold' ? coldDocument(html) : html,
      'utf8',
    ).toString('base64'),
  };
};
