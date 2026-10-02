// crap4ts 2.x ships no declarations; analyze() returns the scorecard as JSON.
declare module 'crap4ts' {
  export function analyze(options: {
    sourceRoot: string;
    coveragePath: string;
    threshold?: number;
  }): string;
}
