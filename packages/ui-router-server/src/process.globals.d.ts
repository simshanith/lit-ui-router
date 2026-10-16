// The one `process` read, in dev-warn.ts behind import.meta.env.NODE; check:dev-split
// keeps it out of dist/*.js and dist/development/*.js, which target WinterTC
// runtimes. Shaped as node's own declarations so the two merge in the test
// graph; tsconfig.runtime-globals.json withdraws it by name.

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: string;
  }

  interface Process {
    env: ProcessEnv;
  }
}

// oxlint-disable-next-line no-var -- merges with node's own `var process` in the test graph
declare var process: NodeJS.Process;
