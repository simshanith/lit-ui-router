/** @typedef {{ id: string, name: string, hex: string, note: string }} Swatch */

/** @type {readonly Swatch[]} */
export const SWATCHES = [
  {
    id: 'vermilion',
    name: 'Vermilion',
    hex: '#e34234',
    note: 'Ground cinnabar; the red of lacquerware.',
  },
  {
    id: 'ultramarine',
    name: 'Ultramarine',
    hex: '#3f00ff',
    note: 'Once lapis lazuli, worth more than gold.',
  },
  {
    id: 'viridian',
    name: 'Viridian',
    hex: '#40826d',
    note: 'A hydrated chromium oxide, stable in any light.',
  },
  {
    id: 'ochre',
    name: 'Yellow Ochre',
    hex: '#cc7722',
    note: 'Clay and iron, on cave walls for forty millennia.',
  },
];

/** @param {string} id */
export const findSwatch = (id) => SWATCHES.find((swatch) => swatch.id === id);
