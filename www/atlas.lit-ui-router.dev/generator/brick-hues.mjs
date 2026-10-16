// Each brick's hue, by package name: the one table sheet 2's plate, the parts
// callout and the model in the round read, so no two of them can disagree.
export const BRICK_HUES = {
  'lit-ui-router': '#D8A33A',
  'ui-router-navigation-location-plugin': '#5B8E4B',
  'lit-ui-router-mobx': '#D26E2C',
  'ui-router-server': '#3E8A8B',
  'lit-ui-router-effect': '#7B5B9F',
  'lit-ui-router-ssr': '#4C86C6',
  'lit-ui-router-signals': '#B0507E',
  'ui-router-effect': '#9C86C4',
  'ui-router-signals': '#CC86A8',
  'ui-router-mobx': '#E39A66',
};

/** A brick's hue; a brick the table does not name throws. */
export function hueOf(name) {
  const hue = BRICK_HUES[name];
  if (!hue) throw new Error(`brick-hues: no hue for ${name} — add it to BRICK_HUES`);
  return hue;
}
