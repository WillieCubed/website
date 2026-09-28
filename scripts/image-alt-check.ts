import matter from 'gray-matter';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import ts from 'typescript';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import { imageAltIssue } from '../lib/accessibility/alt-policy';

export interface AltIssue {
  file: string;
  line: number;
  message: string;
}

function issue(file: string, line: number, message: string): AltIssue {
  return { file, line, message };
}

function mediaAlt(
  value: unknown,
  file: string,
  label: string,
  issues: AltIssue[],
  allowDecorative = true
) {
  if (typeof value === 'string' && value.trim()) {
    issues.push(
      issue(
        file,
        1,
        `${label}: Images need an object with a URL and nonblank alt text.`
      )
    );
    return;
  }
  if (!value || typeof value !== 'object') return;
  const media = value as Record<string, unknown>;
  if (!media.src && !media.url && !media.imageUrl) return;
  const message = imageAltIssue(
    media.alt,
    allowDecorative && media.decorative === true
  );
  if (message) issues.push(issue(file, 1, `${label}: ${message}`));
}

function mdxAlt(
  attributes: { name?: string; value?: unknown }[],
  file: string,
  line: number,
  issues: AltIssue[]
) {
  const alt = attributes.find((attribute) => attribute.name === 'alt');
  const decorative = attributes.some(
    (attribute) =>
      attribute.name === 'aria-hidden' && attribute.value === 'true'
  );
  const message = imageAltIssue(alt?.value, decorative);
  if (message) issues.push(issue(file, line, message));
}

function mdxMediaItems(
  attributes: { name?: string; value?: unknown }[],
  name: 'items' | 'poster',
  file: string,
  line: number,
  issues: AltIssue[]
) {
  const attribute = attributes.find((item) => item.name === name);
  const value = attribute?.value;
  const expression =
    value && typeof value === 'object' && 'value' in value
      ? (value as { value: unknown }).value
      : undefined;
  if (typeof expression !== 'string') {
    issues.push(
      issue(file, line, `${name} needs literal image objects with src and alt.`)
    );
    return;
  }
  const parsed = ts.createSourceFile(
    'media.ts',
    `const media = ${expression};`,
    ts.ScriptTarget.Latest,
    true
  );
  const declaration = (parsed.statements[0] as ts.VariableStatement | undefined)
    ?.declarationList?.declarations[0];
  const root = declaration?.initializer;
  const objects =
    root && ts.isArrayLiteralExpression(root)
      ? root.elements
      : root
        ? [root]
        : [];
  if (objects.length === 0) {
    issues.push(
      issue(file, line, `${name} needs literal image objects with src and alt.`)
    );
  }
  objects.forEach((object, index) => {
    if (!ts.isObjectLiteralExpression(object)) {
      issues.push(
        issue(file, line, `${name}[${index}] needs a literal image object.`)
      );
      return;
    }
    const fields = new Map<string, ts.Expression>();
    for (const property of object.properties) {
      if (
        !ts.isPropertyAssignment(property) ||
        !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
      ) {
        issues.push(
          issue(file, line, `${name}[${index}] needs literal image fields.`)
        );
        return;
      }
      fields.set(property.name.text, property.initializer);
    }
    const src = fields.get('src');
    const alt = fields.get('alt');
    const decorative = fields.get('decorative');
    if (!src) {
      issues.push(issue(file, line, `${name}[${index}] needs src.`));
      return;
    }
    const text =
      alt &&
      (ts.isStringLiteral(alt) || ts.isNoSubstitutionTemplateLiteral(alt))
        ? alt.text
        : undefined;
    const message = imageAltIssue(
      text,
      decorative?.kind === ts.SyntaxKind.TrueKeyword
    );
    if (message)
      issues.push(issue(file, line, `${name}[${index}]: ${message}`));
  });
}

/** Check every authored MDX file, including drafts. */
export function validateMdxImageAlts(file: string, source: string): AltIssue[] {
  const issues: AltIssue[] = [];
  const { data, content } = matter(source);
  const frontmatterLines =
    source.slice(0, source.indexOf(content)).split('\n').length - 1;
  const metadata = data as Record<string, unknown>;

  if (metadata.featuredImage) {
    const message = imageAltIssue(metadata.featuredImageAlt);
    if (message) issues.push(issue(file, 1, `featuredImage: ${message}`));
  }
  if (metadata.thumbnail) {
    const message = imageAltIssue(metadata.thumbnailAlt);
    if (message) issues.push(issue(file, 1, `thumbnail: ${message}`));
  }
  mediaAlt(metadata.cover, file, 'cover', issues);
  const trailer = metadata.trailer as Record<string, unknown> | undefined;
  mediaAlt(trailer?.poster, file, 'trailer poster', issues);
  for (const collection of ['gallery', 'images', 'scenes']) {
    const entries = metadata[collection];
    if (Array.isArray(entries)) {
      entries.forEach((entry, index) =>
        mediaAlt(entry, file, `${collection}[${index}]`, issues)
      );
    }
  }
  if (metadata.photo !== undefined) {
    const photos = Array.isArray(metadata.photo)
      ? metadata.photo
      : [metadata.photo];
    photos.forEach((photo, index) =>
      mediaAlt(photo, file, `photo[${index}]`, issues, false)
    );
  }
  const features = metadata.features;
  if (Array.isArray(features)) {
    features.forEach((feature, index) => {
      if (!feature || typeof feature !== 'object') return;
      mediaAlt(feature, file, `features[${index}]`, issues);
      const screenshots = (feature as Record<string, unknown>).screenshots;
      if (Array.isArray(screenshots)) {
        screenshots.forEach((shot, shotIndex) =>
          mediaAlt(
            shot,
            file,
            `features[${index}].screenshots[${shotIndex}]`,
            issues
          )
        );
      }
    });
  }

  const tree = unified().use(remarkParse).use(remarkMdx).parse(content);
  visit(tree, (node) => {
    const line = (node.position?.start.line ?? 1) + frontmatterLines;
    if (node.type === 'image' || node.type === 'imageReference') {
      const message = imageAltIssue('alt' in node ? node.alt : undefined);
      if (message) issues.push(issue(file, line, message));
    }
    if (
      (node.type === 'mdxJsxFlowElement' ||
        node.type === 'mdxJsxTextElement') &&
      [
        'img',
        'Image',
        'Figure',
        'ImageWithCaption',
        'Scene',
        'Gallery',
        'TrailerBlock',
      ].includes(String(node.name))
    ) {
      if (node.name === 'Gallery') {
        mdxMediaItems(node.attributes, 'items', file, line, issues);
        return;
      }
      if (node.name === 'TrailerBlock') {
        if (
          node.attributes.some(
            (attribute) => 'name' in attribute && attribute.name === 'poster'
          )
        ) {
          mdxMediaItems(node.attributes, 'poster', file, line, issues);
        }
        return;
      }
      mdxAlt(node.attributes, file, line, issues);
    }
  });
  return issues;
}

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
