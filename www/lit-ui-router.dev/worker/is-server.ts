// workerd resolves lit-html's browser build, whose isServer is false; @lit-labs/ssr's server-only `html` throws unless it is true.
export const isServer = true;
