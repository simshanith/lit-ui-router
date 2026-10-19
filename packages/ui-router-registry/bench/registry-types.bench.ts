// How the registry's typecheck cost grows with the state tree. Each task
// typechecks one generated app; `unregistered` is the same code with no
// augmentation, so the gap is the registry's cost. `REGISTRY=<path>` (relative
// to bench/) times another copy of the registry, for an A/B against this one.
/* oxlint-disable turbo/no-undeclared-env-vars -- run by hand, never as a turbo task */
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';

import { Bench } from 'tinybench';

const here = import.meta.dirname;

const require = createRequire(import.meta.url);

const SIZES = (process.env.SIZES ?? '50,200,500,1000').split(',').map(Number);

const BRANCHING = 4;

const REGISTRY = join(here, process.env.REGISTRY ?? '../src/registry.ts');

const TAG = basename(REGISTRY, '.ts');

const NARROWED = 100;

const COMPILERS = {
  'ts5.0': require.resolve('typescript-5.0/bin/tsc'),
  'ts5.9': require.resolve('typescript-5.9/bin/tsc'),
  ts7: join(dirname(require.resolve('typescript-7/package.json')), 'bin/tsc'),
} as const;

interface GenState {
  name: string;
  url: string;
  params?: string;
  required: string[];
}

// A tree `BRANCHING` roots wide, each state with `BRANCHING` children: every state has a path segment, every other one a
// path param, every third an int param, every fifth a query param with a default.
function generate(size: number): GenState[] {
  const states: GenState[] = [];

  for (let i = 0; states.length < size; i++) {
    const parent =
      i < BRANCHING
        ? undefined
        : states[Math.floor((i - BRANCHING) / BRANCHING)];

    const name = parent ? `${parent.name}.s${i}` : `s${i}`;
    const required = [...(parent?.required ?? [])];
    let url = `/seg${i}`;
    let params: string | undefined;

    if (i % 2 === 0) {
      url += `/:p${i}`;
      required.push(`p${i}: 'x'`);
    }

    if (i % 3 === 0) {
      url += `/{n${i}:int}`;
      required.push(`n${i}: 1`);
    }

    if (i % 5 === 0) {
      url += `?q${i}`;
      params = `{ q${i}: { value: 'all', squash: true } }`;
    }

    states.push({ name, url, params, required });
  }

  return states;
}

// `unregistered`: the full usage with no augmentation, the fallback baseline.
// `calls`: registered, go and href only. `relative`: `calls` plus a relative go
// per state. `snapshot`: `calls` plus narrowing.
const ALL_VARIANTS = ['unregistered', 'calls', 'relative', 'snapshot'] as const;

type Variant = (typeof ALL_VARIANTS)[number];

const onlyVariants = process.env.VARIANTS?.split(',');

const VARIANTS = ALL_VARIANTS.filter(
  (v) => !onlyVariants || onlyVariants.includes(v),
);

function writeFixture(dir: string, size: number, variant: Variant) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  // Fixtures live outside the repo; this link resolves `@uirouter/core`.
  symlinkSync(join(here, '../node_modules'), join(dir, 'node_modules'));
  copyFileSync(REGISTRY, join(dir, 'registry.ts'));

  const states = generate(size);

  const decls = states.map(
    (s) =>
      `  { name: '${s.name}', url: '${s.url}'${s.params ? `, params: ${s.params}` : ''} },`,
  );

  writeFileSync(
    join(dir, 'states.ts'),
    `export const states = [\n${decls.join('\n')}\n] as const;\n`,
  );

  writeFileSync(
    join(dir, 'main.ts'),
    variant === 'unregistered'
      ? `export {};\n`
      : `import type { states } from './states';\n\ndeclare module './registry' {\n  interface Register {\n    states: (typeof states)[number];\n  }\n}\n`,
  );

  // One go and one href per state.
  const calls = states.flatMap((s) => {
    const args = s.required.length ? `, { ${s.required.join(', ')} }` : '';

    return [
      `void stateService.go('${s.name}'${args});`,
      `stateService.href('${s.name}'${args});`,
    ];
  });

  // One relative go per state, by its last segment.
  const relatives =
    variant === 'relative'
      ? states.map(
          (s) => `void stateService.go('.${s.name.split('.').at(-1)}');`,
        )
      : [];

  // `NARROWED` snapshot narrowings, spread across the tree's depths.
  const step = Math.max(1, Math.floor(states.length / NARROWED));

  const narrowings =
    variant === 'calls' || variant === 'relative'
      ? []
      : states
          .filter((_, i) => i % step === 0)
          .slice(0, NARROWED)
          .map(
            (s) =>
              `if (snapshot.includes('${s.name}')) { const p = snapshot.params; void p; }`,
          );

  writeFileSync(
    join(dir, 'usage.ts'),
    `import type { TypedRouteSnapshot, TypedStateService } from './registry';\n\ndeclare const stateService: TypedStateService;\ndeclare const snapshot: TypedRouteSnapshot;\n\n${calls.join('\n')}\n\n${relatives.join('\n')}\n\n${narrowings.join('\n')}\n`,
  );

  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'es2022',
        module: 'esnext',
        moduleResolution: 'bundler',
        lib: ['es2022', 'dom'],
        types: [],
        strict: true,
        noEmit: true,
        skipLibCheck: true,
      },
      include: ['*.ts'],
    }),
  );
}

// A failing check still reports its diagnostics; the error count goes in the table.
const tsc = (bin: string, dir: string, extra: string[] = []): string => {
  try {
    return execFileSync(process.execPath, [bin, '-p', dir, ...extra], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    // SAFETY: execFileSync's error carries the child's stdout
    return (error as { stdout: string }).stdout;
  }
};

const stat = (out: string, label: string) =>
  new RegExp(`^${label}:\\s+([\\d.]+)`, 'm').exec(out)?.[1] ?? '?';

const errorCodes = (out: string) =>
  [...new Set(out.match(/error TS\d+/g) ?? [])].join(' ') || '-';

const only = process.env.COMPILERS?.split(',');

const compilers = Object.entries(COMPILERS).filter(
  ([name]) => !only || only.includes(name),
);

const root = mkdtempSync(join(tmpdir(), `registry-bench-${TAG}-`));

const bench = new Bench({
  name: 'registry typecheck',
  throws: true,
  time: 0,
  iterations: Number(process.env.ITERATIONS ?? 3),
  warmupIterations: 0,
});

const stats: Record<string, string | number>[] = [];

for (const size of SIZES)
  for (const variant of VARIANTS) {
    const dir = join(root, `n${size}-${variant}`);

    writeFixture(dir, size, variant);

    for (const [compiler, bin] of compilers) {
      const name = `${compiler} ${variant} n=${size}`;
      const out = tsc(bin, dir, ['--extendedDiagnostics']);

      stats.push({
        task: name,
        errors: errorCodes(out),
        instantiations: stat(out, 'Instantiations'),
        types: stat(out, 'Types'),
        'check s': stat(out, 'Check time'),
        'memory K': stat(out, 'Memory used'),
      });

      bench.add(name, () => {
        tsc(bin, dir);
      });
    }
  }

console.table(stats);

await bench.run();

console.table(bench.table());

rmSync(root, { recursive: true, force: true });
