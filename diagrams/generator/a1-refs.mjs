// APPENDIX A1 — THE REFERENCE STRIP.
//
// The six fair-use thumbnails the sprite studies were argued from, and the one
// place in the atlas where a raster is drawn. Each row names the file under
// `generator/assets/a1/`, the page it was taken from, the sentence it teaches
// and a one-line credit; the notes on sheet A1 carry the full citations.
//
// WHY INLINE, AND NOT A <image href="assets/…"> REFERENCE. The set is carried
// as one document three different ways — the flat SVG sheets, the routed app's
// fragments and the single-file claude.ai artifact — and the artifact host
// allows no image fetches at all. A linked file would be a hole in two of the
// three. So the jpg is read at BUILD time and inlined as a data URI: the sheet
// stays one self-contained document wherever it is served from.
import { readFileSync } from 'node:fs';

/** The jpg on disk, as a base64 data URI. Read once, at build time. */
export const dataUri = (file) =>
  `data:image/jpeg;base64,${readFileSync(new URL(`./assets/a1/${file}`, import.meta.url)).toString('base64')}`;

// study: which of the three ladders the thumbnail was cited for.
// teach:  the sentence drawn under the thumbnail, ≤ ~110 chars.
// credit: the one line drawn under that — rights holder, then the source named.
export const REFS = [
  {
    study: 1,
    group: 'STUDY 1 · HORIZON ZERO DAWN — OVERGROWTH IS TIME',
    file: 'hzd-machines.jpg',
    href: 'https://en.wikipedia.org/wiki/Horizon_Zero_Dawn',
    alt: 'Horizon Zero Dawn — machines grazing a reclaimed landscape',
    teach: 'machines read as fauna in a reclaimed landscape — the machine is intact, the world around it has moved on',
    credit: '© Guerrilla Games / SIE · wikipedia.org',
  },
  {
    study: 1,
    group: 'STUDY 1 · HORIZON ZERO DAWN — OVERGROWTH IS TIME',
    file: 'ta-prohm.jpg',
    href: 'https://commons.wikimedia.org/wiki/File:Angkor_Wat_Ta_Prohm_Temple_doorway_overgrown_with_tree_roots.jpg',
    alt: 'Ta Prohm temple doorway at Angkor, overgrown with tree roots',
    teach: 'overgrowth rides edges and openings while the masonry keeps its silhouette — decay as overlay, never erasure',
    credit: 'Ta Prohm, Angkor · commons.wikimedia.org',
  },
  {
    study: 2,
    group: 'STUDY 2 · SIMCITY 2000 — THE ROOF IS THE READING',
    file: 'sc2k.jpg',
    href: 'https://en.wikipedia.org/wiki/SimCity_2000',
    alt: 'SimCity 2000 — a dimetric city block read from its roofs',
    teach: 'a dimetric city read almost entirely from its roofs — density, condition and identity all on the top face',
    credit: '© Maxis / Electronic Arts · wikipedia.org',
  },
  {
    study: 2,
    group: 'STUDY 2 · SIMCITY 2000 — THE ROOF IS THE READING',
    file: 'scurk.jpg',
    href: 'https://en.wikipedia.org/wiki/SimCity_2000',
    alt: 'SimCity Urban Renewal Kit — fixed-size building tiles in a fixed palette',
    teach: 'every building is a fixed-size tile in a fixed palette — the constraint that makes whole-city re-skins safe',
    credit: 'SCURK © Maxis / EA · wikipedia.org',
  },
  {
    study: 3,
    group: 'STUDY 3 · FACTORIO — STATE IS BROADCAST, NEVER IMPLIED',
    file: 'fff-355-remnants.jpg',
    href: 'https://www.factorio.com/blog/post/fff-355',
    alt: 'Factorio Friday Facts 355 — assembling-machine remnants beside working machines',
    teach: 'the wreck state is a designed sprite, not a missing one — remnants sit beside working machines',
    credit: '© Wube Software · factorio.com FFF #355',
  },
  {
    study: 3,
    group: 'STUDY 3 · FACTORIO — STATE IS BROADCAST, NEVER IMPLIED',
    file: 'fff-228-turrets.jpg',
    href: 'https://www.factorio.com/blog/post/fff-228',
    alt: 'Factorio Friday Facts 228 — high-resolution turrets redrawn for readability',
    teach: 'silhouette first, effects second — an entity redrawn for readability, the order the plant sprite follows',
    credit: '© Wube Software · factorio.com FFF #228',
  },
];
