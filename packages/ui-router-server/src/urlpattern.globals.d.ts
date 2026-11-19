// The URLPattern surface ./url-pattern touches, absent from the DOM-free ES2022 lib;
// tsconfig.runtime-globals.json withdraws it so node's real URLPattern checks the same call sites.

interface URLPatternInit {
  protocol?: string;
  username?: string;
  password?: string;
  hostname?: string;
  port?: string;
  pathname?: string;
  search?: string;
  hash?: string;
  baseURL?: string;
}

interface URLPatternOptions {
  ignoreCase?: boolean;
}

interface URLPatternComponentResult {
  input: string;
  groups: Record<string, string | undefined>;
}

interface URLPatternResult {
  pathname: URLPatternComponentResult;
}

declare class URLPattern {
  constructor(input: URLPatternInit, options?: URLPatternOptions);
  exec(input: URLPatternInit): URLPatternResult | null;
  readonly hasRegExpGroups: boolean;
  readonly pathname: string;
}
