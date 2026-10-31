// Server-side marker rewriting shared by the view renderer and the light-element renderer, in a module neither imports through the other.
import { servedMarkerPrefix } from './served-markers.js';

/** The close of the part pair `renderValue` writes around a hydratable value. */
export const PART_CLOSE = '<!--/lit-part-->';

/**
 * Hides the markers this render wrote inside the view from the walk hydrating
 * its surroundings, leaving the outer pair plain for that walk to read.
 *
 * @internal
 */
export const prefixInterior = (markup: string): string => {
  // renderValue always wraps a hydratable value in the pair, so the ends are the pair by construction.
  const open = markup.indexOf('-->') + 3;
  const close = markup.length - PART_CLOSE.length;

  // A plain `<!--lit-part` never matches an already-prefixed `<!--served:lit-part`, so a nested run's interior is prefixed once.
  const interior = markup
    .slice(open, close)
    .replaceAll('<!--lit-part', `<!--${servedMarkerPrefix}lit-part`)
    .replaceAll('<!--/lit-part', `<!--${servedMarkerPrefix}/lit-part`)
    .replaceAll('<!--lit-node', `<!--${servedMarkerPrefix}lit-node`);

  return markup.slice(0, open) + interior + markup.slice(close);
};
