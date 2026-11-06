// What the browser hands back for `import sheet from './x.css' with { type: 'css' }`.
declare module '*.css' {
  const sheet: CSSStyleSheet;
  export default sheet;
}
