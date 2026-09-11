// The card picture's one specification, shared by the step that renders it
// (thumbs.mjs) and the step that asserts every card has one (build.mjs).

/** The card box, in CSS pixels — 259 × 150 is the cover's card at its grid minimum. */
export const THUMB_W = 259;
export const THUMB_H = 150;
/** Rendered at 2×, so the picture holds up on a retina display. */
export const THUMB_SCALE = 2;
/** Under `app/public/`, and served at `${BASE}thumbs/`. */
export const THUMB_DIR = 'thumbs';

/** A plate's file for one theme — the dark one is the same crop in cyanotype. */
export const thumbFile = (id, theme) => `${id}${theme === 'dark' ? '-dark' : ''}.webp`;

/** What a manifest row carries: the two paths, relative to the app's base. */
export const thumbPaths = (id) => ({
  light: `${THUMB_DIR}/${thumbFile(id, 'light')}`,
  dark: `${THUMB_DIR}/${thumbFile(id, 'dark')}`,
});
