import * as v from 'valibot';

const AnalysisSchema = v.object({
  result: v.object({
    functions: v.array(
      v.object({
        scored: v.object({
          identity: v.object({
            file_path: v.string(),
            qualified_name: v.string(),
            span: v.object({ start_line: v.number() }),
          }),
          complexity: v.number(),
          coverage_percent: v.number(),
          crap: v.object({ value: v.number() }),
        }),
        threshold: v.number(),
        exceeds: v.boolean(),
      }),
    ),
  }),
});

export interface Hotspot {
  location: string;
  name: string;
  crap: number;
  complexity: number;
  coverage: number;
  exceeds: boolean;
}

export interface Report {
  files: number;
  threshold: number | undefined;
  hotspots: Hotspot[];
}

/**
 * Package-relative form of a coverage-final.json key. Keys are absolute on
 * the machine that ran the tests, which differs on a remote cache hit.
 */
export function packageRelative(coverageKey: string, packageDir: string) {
  const key = coverageKey.replaceAll('\\', '/');
  const marker = `/${packageDir}/`;
  const at = key.lastIndexOf(marker);

  return at === -1 ? undefined : key.slice(at + marker.length);
}

/**
 * Rank crap4ts' scorecard, keeping only functions in files the coverage run
 * instrumented; crap4ts scores every file under `sourceRoot`, specs included.
 */
export function rank(
  analysisJson: string,
  sourceRoot: string,
  coveredFiles: ReadonlySet<string>,
): Report {
  const { result } = v.parse(AnalysisSchema, JSON.parse(analysisJson));
  const hotspots: Hotspot[] = [];
  const files = new Set<string>();
  let threshold: number | undefined;

  for (const { scored, threshold: t, exceeds } of result.functions) {
    const file = `${sourceRoot}/${scored.identity.file_path}`;

    if (!coveredFiles.has(file)) continue;
    files.add(file);
    threshold = t;
    hotspots.push({
      location: `${file}:${scored.identity.span.start_line}`,
      name: scored.identity.qualified_name,
      crap: scored.crap.value,
      complexity: scored.complexity,
      coverage: scored.coverage_percent,
      exceeds,
    });
  }

  hotspots.sort((a, b) => b.crap - a.crap || b.complexity - a.complexity);

  return { files: files.size, threshold, hotspots };
}

export function formatReport(label: string, report: Report, top: number) {
  const over = report.hotspots.filter((h) => h.exceeds).length;

  const lines = [
    `${label}: ${report.hotspots.length} functions in ${report.files} files, ` +
      `${over} over CRAP ${report.threshold ?? '-'}`,
    `${'CRAP'.padStart(7)} ${'CC'.padStart(3)} ${'COV'.padStart(4)}  FUNCTION`,
  ];

  for (const h of report.hotspots.slice(0, top)) {
    lines.push(
      `${h.exceeds ? '!' : ' '}${h.crap.toFixed(1).padStart(6)} ` +
        `${String(h.complexity).padStart(3)} ` +
        `${`${Math.round(h.coverage)}%`.padStart(4)}  ${h.name}  ${h.location}`,
    );
  }

  return lines.join('\n');
}
