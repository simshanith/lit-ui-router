// Usage: bun mise-pin.bun.ts <config.toml> <tool> — prints the tool's `[tools]`
// pin when it is a plain version string, else nothing. Bun, because node has no
// TOML parser; cloudflare-build.ts runs it before `pnpm install`, so it imports
// nothing.
type MiseConfig = {
  // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- mise's own shape: tool name to a version string or an options table
  readonly tools?: Readonly<Partial<Record<string, string | object>>>;
};

const [configPath = '', tool = ''] = Bun.argv.slice(2);

// SAFETY: a mise config is a TOML table whose [tools] values are a version string or a table.
const config = Bun.TOML.parse(await Bun.file(configPath).text()) as MiseConfig;

const pin = config.tools?.[tool];

// oxlint-disable-next-line anti-slop/no-runtime-typeof -- mise's own union: a string is a plain pin, a table carries options
if (typeof pin === 'string') console.log(pin);
