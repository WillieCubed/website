import ts from 'typescript';

import { imageAltIssue } from '../lib/accessibility/alt-policy';
import { type AltIssue, issue } from '../lib/accessibility/mdx-image-alt-check';

export { validateMdxImageAlts } from '../lib/accessibility/mdx-image-alt-check';

/** Check authored JSX images. Dynamic values remain subject to runtime tests. */
export function validateTsxImageAlts(file: string, source: string): AltIssue[] {
  const issues: AltIssue[] = [];
  const tree = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const imageTags = new Set(['img', 'Image']);
  for (const statement of tree.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === 'next/image' &&
      statement.importClause?.name
    ) {
      imageTags.add(statement.importClause.name.text);
    }
  }
  const check = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = node.tagName.getText(tree);
      if (imageTags.has(name)) {
        const attributes = node.attributes.properties;
        const alt = attributes.find(
          (attribute): attribute is ts.JsxAttribute =>
            ts.isJsxAttribute(attribute) &&
            attribute.name.getText(tree) === 'alt'
        );
        const hidden = attributes.some(
          (attribute) =>
            ts.isJsxAttribute(attribute) &&
            attribute.name.getText(tree) === 'aria-hidden' &&
            ((attribute.initializer &&
              ts.isStringLiteral(attribute.initializer) &&
              attribute.initializer.text === 'true') ||
              (attribute.initializer &&
                ts.isJsxExpression(attribute.initializer) &&
                attribute.initializer.expression?.kind ===
                  ts.SyntaxKind.TrueKeyword))
        );
        const value = alt?.initializer;
        const expression =
          value && ts.isJsxExpression(value) ? value.expression : undefined;
        const text = (node: ts.Node) =>
          ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
            ? node.text
            : undefined;
        const literal = value
          ? (text(value) ?? (expression ? text(expression) : undefined))
          : undefined;
        let invalidBranch = false;
        const findInvalidBranch = (child: ts.Node) => {
          const branchText = text(child);
          if (
            (branchText !== undefined && !branchText.trim()) ||
            (ts.isIdentifier(child) && child.text === 'undefined') ||
            child.kind === ts.SyntaxKind.NullKeyword
          ) {
            invalidBranch = true;
          }
          ts.forEachChild(child, findInvalidBranch);
        };
        if (expression) findInvalidBranch(expression);
        const message =
          !alt || literal !== undefined
            ? imageAltIssue(literal, hidden)
            : hidden || invalidBranch
              ? 'Dynamic alt must stay nonblank; decorative images need literal alt="".'
              : null;
        if (message) {
          issues.push(
            issue(
              file,
              tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
              message
            )
          );
        }
      }
    }
    ts.forEachChild(node, check);
  };
  check(tree);
  return issues;
}
