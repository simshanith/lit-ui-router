import { readFileSync } from 'node:fs';

import { parseHtml } from '@tools/lit-test-env/parse-html.ts';

/** Parses a built page for `check`, then closes its happy-dom window: 400 open windows exhaust the heap. */
export async function withPage(file: string, check: (doc: Document) => void) {
  const doc = parseHtml(readFileSync(file, 'utf8'));

  try {
    check(doc);
  } finally {
    // SAFETY: parseHtml's document belongs to a happy-dom window, whose happyDOM handle lib.dom doesn't declare.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- happy-dom declares its DOM apart from lib.dom
    const window = doc.defaultView as unknown as {
      happyDOM: { close: () => Promise<void> };
    };

    await window.happyDOM.close();
  }
}
