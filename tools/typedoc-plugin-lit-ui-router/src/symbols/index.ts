import { UIROUTER_SYMBOLS } from './ui-router.js';
import { LIT_SYMBOLS } from './lit.js';

export { UIROUTER_SYMBOLS, LIT_SYMBOLS };

export const EXTERNAL_SYMBOLS: Record<string, string> = {
  ...UIROUTER_SYMBOLS,
  ...LIT_SYMBOLS,
};
