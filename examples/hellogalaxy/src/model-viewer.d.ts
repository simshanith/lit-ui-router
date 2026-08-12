// @google/model-viewer builds its element from a mixin chain, so its shipped
// types expose no attributes for web-component-analyzer to read.
/**
 * @element model-viewer
 * @attr {string} src
 * @attr {string} alt
 * @attr {boolean} camera-controls
 * @attr {boolean} auto-rotate
 * @attr {boolean} ar
 * @attr {string} touch-action
 */
declare class ModelViewerLocal extends HTMLElement {}
