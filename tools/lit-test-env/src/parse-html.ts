import { Window } from 'happy-dom';

// happy-dom computes no default `display`, and dom-accessibility-api pads a non-inline child's text with spaces.
const PHRASING =
  'a, abbr, b, code, em, i, kbd, small, span, strong, time { display: inline }';

/** Parses a page into a document whose `defaultView` answers testing-library's style lookups. */
export const parseHtml = (html: string): Document => {
  const parsed = new new Window().DOMParser().parseFromString(
    html,
    'text/html',
  );

  // SAFETY: happy-dom implements lib.dom's Document; testing-library reads only the members they share.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- happy-dom declares its DOM apart from lib.dom
  const doc = parsed as unknown as Document;

  const style = doc.createElement('style');
  style.textContent = PHRASING;
  doc.head.append(style);

  return doc;
};
