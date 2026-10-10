// Stateless shared code ships by copy: one canonical file under
// packages/shared/*/src/, a committed copy in each consumer's src/shared/.
import ts from 'typescript-6';

export const CANONICAL_GLOB = 'packages/shared/*/src/*.ts';

export const CANONICAL_EXCLUDE: string[] = [
  'packages/shared/*/src/*.spec.ts',
  'packages/shared/*/src/*.d.ts',
];

export const COPY_GLOB = 'packages/*/src/shared/*.ts';

export const SYNC_COMMAND = 'pnpm run sync:shared-source';

const HEADER =
  /^\/\/ Copied from (\S+) by `[^`]+`; edit that file, not this copy\.$/;

export function header(canonical: string): string {
  return `// Copied from ${canonical} by \`${SYNC_COMMAND}\`; edit that file, not this copy.`;
}

/** The canonical path a copy's first line names, or undefined without a header. */
export function canonicalOf(copy: string): string | undefined {
  return HEADER.exec(copy.split('\n', 1)[0] ?? '')?.[1];
}

export function expectedCopy(canonical: string, source: string): string {
  return `${header(canonical)}\n${source}`;
}

export interface CopyAudit {
  /** Copy path to the canonical path it names, from the files on disk. */
  copies: ReadonlyMap<string, string | undefined>;
  canonicals: ReadonlySet<string>;
  read: (path: string) => string;
}

/** Every reason the copies disagree with their canonical sources. */
export function auditCopies({ copies, canonicals, read }: CopyAudit): string[] {
  const failures: string[] = [];
  const used = new Set<string>();

  for (const [copy, canonical] of copies) {
    if (canonical === undefined) {
      failures.push(
        `${copy}: no "// Copied from" header; src/shared/ holds copies only`,
      );
      continue;
    }

    if (!canonicals.has(canonical)) {
      failures.push(
        `${copy}: names ${canonical}, which is not a canonical source`,
      );
      continue;
    }

    used.add(canonical);

    if (read(copy) !== expectedCopy(canonical, read(canonical))) {
      failures.push(`${copy}: drifted from ${canonical}`);
    }
  }

  for (const canonical of canonicals) {
    if (!used.has(canonical))
      failures.push(`${canonical}: no package holds a copy`);
  }

  return failures;
}

const isLiteral = (node: ts.Expression): boolean =>
  ts.isStringLiteral(node) ||
  ts.isNumericLiteral(node) ||
  ts.isBigIntLiteral(node) ||
  ts.isNoSubstitutionTemplateLiteral(node) ||
  node.kind === ts.SyntaxKind.TrueKeyword ||
  node.kind === ts.SyntaxKind.FalseKeyword ||
  node.kind === ts.SyntaxKind.NullKeyword ||
  (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand));

const isStatelessInitializer = (node: ts.Expression | undefined): boolean =>
  node !== undefined &&
  (ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    isLiteral(node));

function isStatelessStatement(statement: ts.Statement): boolean {
  if (
    ts.isImportDeclaration(statement) ||
    ts.isExportDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isFunctionDeclaration(statement)
  ) {
    return true;
  }

  if (!ts.isVariableStatement(statement)) return false;
  const { declarationList } = statement;

  return (
    (declarationList.flags & ts.NodeFlags.Const) !== 0 &&
    declarationList.declarations.every((declaration) =>
      isStatelessInitializer(declaration.initializer),
    )
  );
}

/**
 * Top-level statements that could hold module state or run a side effect:
 * anything but imports, re-exports, types, functions, and `const` bindings of
 * functions or primitive literals.
 */
export function statefulStatements(file: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
  );

  return sourceFile.statements
    .filter((statement) => !isStatelessStatement(statement))
    .map((statement) => {
      const { line } = sourceFile.getLineAndCharacterOfPosition(
        statement.getStart(),
      );

      const text = statement.getText().split('\n', 1)[0] ?? '';

      return `${file}:${line + 1}: ${text}`;
    });
}
