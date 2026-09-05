/**
 * Document titles, in one place: prerender.ts writes them into each page's
 * <title>, and the router sets document.title from the same strings on every
 * client navigation, so the two can never drift.
 */
import type { SheetRow } from './manifest.ts';

const SET = 'The Altitude Atlas';

export const TITLES = {
  gallery: `${SET} — Drawing Set`,
  about: `About — ${SET}`,
  megacanvas: `The Megacanvas — ${SET}`,
  notFound: `Not in the set — ${SET}`,
} as const;

export const sheetTitle = (row: SheetRow): string =>
  `${row.title} — Sheet ${row.num} · ${SET}`;

/** The title for a state, given the resolved sheet when the state is a sheet. */
export function titleFor(state: string | undefined, sheet?: SheetRow): string {
  switch (state) {
    case 'atlas.sheet':
      return sheet ? sheetTitle(sheet) : TITLES.gallery;
    case 'atlas.about':
      return TITLES.about;
    case 'atlas.megacanvas':
      return TITLES.megacanvas;
    case 'atlas.notFound':
      return TITLES.notFound;
    default:
      return TITLES.gallery;
  }
}
