import postcss from 'postcss';
import ts from 'typescript';

export interface SpacingFinding {
  file: string;
  line: number;
  selector: string;
  property: string;
  value: string;
}

const spacingProperty =
  /^(?:margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left|scroll-margin|scroll-padding|border-spacing|text-indent)(?:-|$)/;
const spacingToken =
  /^--.*(?:gap|gutter|padding|pad(?:-|$)|margin|space|spacing|inset|edge|indent|clearance|pill-[xy]|peek)/;
const length = /(-?(?:\d*\.)?\d+)(px|rem)\b/g;

export function isSpacingProperty(property: string): boolean {
  if (property.includes('letter-spacing')) return false;
  return spacingProperty.test(property) || spacingToken.test(property);
}

export function offGridLengths(value: string): number[] {
  return [...value.matchAll(length)]
    .map((match) => Number(match[1]) * (match[2] === 'rem' ? 16 : 1))
    .filter(
      (pixels) => Math.abs(pixels / 4 - Math.round(pixels / 4)) > 0.00001
    );
}

function isOffGrid(property: string, value: string): boolean {
  if (!isSpacingProperty(property)) return false;
  if (property.startsWith('--') && /^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value) % 4 !== 0;
  }
  return offGridLengths(value).length > 0;
}

function finding(
  file: string,
  line: number,
  selector: string,
  property: string,
  value: string
): SpacingFinding | undefined {
  if (!isOffGrid(property, value)) return;
  return {
    file,
    line,
    selector: selector.replace(/\s+/g, ' '),
    property,
    value,
  };
}

export function scanCss(
  file: string,
  source: string,
  offset = 0
): SpacingFinding[] {
  const found: SpacingFinding[] = [];
  postcss.parse(source, { from: file }).walkDecls((declaration) => {
    const selector =
      declaration.parent?.type === 'rule'
        ? declaration.parent.selector
        : 'tokens';
    const entry = finding(
      file,
      (declaration.source?.start?.line ?? 1) + offset,
      selector,
      declaration.prop,
      declaration.value
    );
    if (entry) found.push(entry);
  });
  return found;
}

const utility =
  /(?:^|:)(-?(?:p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?|space-[xy]|inset(?:-[xy])?|top|right|bottom|left|start|end|scroll-[mp][xytrblse]?))-(\[([^\]]+)\]|(\d+(?:\.\d+)?)|px)$/;

function utilitySpacing(
  token: string
): { property: string; value: string } | undefined {
  const arbitrary = token.match(/\[([a-z-]+):([^\]]+)\]$/);
  if (arbitrary && isSpacingProperty(arbitrary[1]))
    return { property: arbitrary[1], value: arbitrary[2].replaceAll('_', ' ') };
  const match = token.match(utility);
  if (!match) return;
  if (match[2] === 'px') return { property: 'gap', value: '1px' };
  return {
    property: 'gap',
    value: match[3]
      ? match[3].replaceAll('_', ' ')
      : `${Number(match[4]) * 4}px`,
  };
}

export function scanClasses(
  file: string,
  source: string,
  line = 1
): SpacingFinding[] {
  return [...source.matchAll(/\S+/g)].flatMap((token) => {
    const spacing = utilitySpacing(token[0]);
    if (!spacing) return [];
    const entry = finding(
      file,
      line + source.slice(0, token.index).split('\n').length - 1,
      token[0],
      spacing.property,
      spacing.value
    );
    return entry ? [entry] : [];
  });
}

function scanEmbedded(
  file: string,
  text: string,
  line: number
): SpacingFinding[] {
  const found: SpacingFinding[] = [];
  for (const match of text.matchAll(/class(?:Name)?=["']([^"']+)["']/g)) {
    found.push(
      ...scanClasses(
        file,
        match[1],
        line - 1 + text.slice(0, match.index).split('\n').length
      )
    );
  }
  for (const match of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    const start = match.index + match[0].indexOf(match[1]);
    found.push(
      ...scanCss(
        file,
        match[1],
        line - 1 + text.slice(0, start).split('\n').length - 1
      )
    );
  }
  for (const match of text.matchAll(/style=["']([^"']+)["']/g)) {
    found.push(
      ...scanCss(
        file,
        `inline{${match[1]}}`,
        line - 1 + text.slice(0, match.index).split('\n').length - 1
      )
    );
  }
  return found;
}

function templateText(node: ts.TemplateExpression, ast: ts.SourceFile): string {
  return (
    node.head.text +
    node.templateSpans
      .map(
        (span) =>
          '0' +
          '\n'.repeat(span.expression.getText(ast).split('\n').length - 1) +
          span.literal.text
      )
      .join('')
  );
}

function objectValue(node: ts.Expression): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  if (ts.isNumericLiteral(node)) return `${node.text}px`;
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand))
    return `${node.getText()}px`;
}

function scanProperty(
  file: string,
  node: ts.PropertyAssignment,
  ast: ts.SourceFile
): SpacingFinding[] {
  const property = node.name
    .getText(ast)
    .replace(/^['"]|['"]$/g, '')
    .replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
  const value = objectValue(node.initializer);
  if (value === undefined) return [];
  const entry = finding(
    file,
    ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
    'style/object',
    property,
    value
  );
  return entry ? [entry] : [];
}

function nodeText(node: ts.Node, ast: ts.SourceFile): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  if (ts.isTemplateExpression(node)) return templateText(node, ast);
}

export function scanTypeScript(file: string, source: string): SpacingFinding[] {
  const ast = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const found: SpacingFinding[] = [];
  function visit(node: ts.Node) {
    const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
    const text = nodeText(node, ast);
    if (text !== undefined)
      found.push(
        ...scanClasses(file, text, line),
        ...scanEmbedded(file, text, line)
      );
    if (ts.isPropertyAssignment(node))
      found.push(...scanProperty(file, node, ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return found;
}

export function scanFile(file: string, source: string): SpacingFinding[] {
  if (/\.css$/.test(file)) return scanCss(file, source);
  if (/\.(?:tsx?|mts)$/.test(file)) return scanTypeScript(file, source);
  return [...scanEmbedded(file, source, 1), ...scanClasses(file, source)];
}
