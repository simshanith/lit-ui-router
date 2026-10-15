// An axe violation as a finding, and the lines check-a11y prints for one.

import type { AxeBuilder } from '@axe-core/playwright';

export type Scheme = 'light' | 'dark';

export type Violation = Awaited<
  ReturnType<AxeBuilder['analyze']>
>['violations'][number];

type NodeResult = Violation['nodes'][number];

type CheckResult = NodeResult['any'][number];

/** One axe check on a node: target-size's `data.messageKey` and `relatedNodes` say what covered it. */
export interface FindingCheck {
  id: string;
  message: string;
  data: unknown;
  /** Selectors of the elements the check blames, such as those obscuring the target. */
  related: string[];
}

export interface FindingNode {
  target: string;
  checks: FindingCheck[];
}

export interface Finding {
  page: string;
  scheme: Scheme;
  rule: string;
  impact: string;
  help: string;
  nodes: FindingNode[];
  /** The page as axe left it, relative to the working directory. */
  screenshot?: string;
}

function selector(target: NodeResult['target']): string {
  return target.map((part) => [part].flat().join(' >> ')).join(' >> ');
}

function check(result: CheckResult): FindingCheck {
  return {
    id: result.id,
    message: result.message,
    data: result.data,
    related: (result.relatedNodes ?? []).map((node) => selector(node.target)),
  };
}

export function findingOf(
  violation: Violation,
  page: string,
  scheme: Scheme,
): Finding {
  return {
    page,
    scheme,
    rule: violation.id,
    impact: violation.impact ?? 'unknown',
    help: violation.help,
    nodes: violation.nodes.map((node) => ({
      target: selector(node.target),
      checks: [...node.any, ...node.all, ...node.none].map(check),
    })),
  };
}

/** The human report for one finding: a header, then each target with its checks indented below. */
export function formatFinding(finding: Finding): string[] {
  const lines = [
    `${finding.page} [${finding.scheme}] ${finding.rule} (${finding.impact}): ${finding.help}`,
  ];

  if (finding.screenshot !== undefined) {
    lines.push(`  screenshot: ${finding.screenshot}`);
  }

  for (const node of finding.nodes) {
    lines.push(`  ${node.target}`);

    for (const result of node.checks) {
      lines.push(`    ${result.id}: ${result.message}`);

      if (result.related.length > 0) {
        lines.push(`      related: ${result.related.join(', ')}`);
      }
    }
  }

  return lines;
}

/** A file name for a scan's screenshot, unique among `taken`, which it joins. */
export function screenshotName(
  page: string,
  scheme: Scheme,
  taken: Set<string>,
): string {
  const stem = `${page} ${scheme}`
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');

  let name = `${stem}.png`;

  for (let n = 2; taken.has(name); n++) name = `${stem}-${n}.png`;
  taken.add(name);

  return name;
}
