// typescript-eslint hard-errors on TypeScript 7 (no JS API). The typescript6-compat
// devDep here is what its `typescript` peer resolves against, so the import must
// stay inside this package — importing the parser from the root would get TS 7.
export { default } from '@typescript-eslint/parser';
