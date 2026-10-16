// Stateless shared code ships inlined: @tools/oxc-emit compiles each canonical
// file under packages/shared/*/src/ into every consumer's dist/shared/.
import ts from 'typescript-6';

export const CANONICAL_GLOB = 'packages/shared/*/src/*.ts';

export const CANONICAL_EXCLUDE: string[] = [
  'packages/shared/*/src/*.spec.ts',
  'packages/shared/*/src/*.d.ts',
];

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

  // ambient: types only, nothing emits
  if (
    statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword,
    )
  ) {
    return true;
  }

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
 * anything but imports, re-exports, types, functions, ambient `declare`
 * bindings, and `const` bindings of functions or primitive literals.
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
