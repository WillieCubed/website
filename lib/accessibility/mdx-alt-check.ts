import matter from 'gray-matter';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import { imageAltIssue } from './alt-policy';

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
  type Node = {
    type: string;
    name?: string;
    value?: unknown;
    key?: Node;
    computed?: boolean;
    shorthand?: boolean;
    properties?: Node[];
    elements?: Node[];
    expressions?: Node[];
    quasis?: { value?: { cooked?: string } }[];
  };
  const value = attribute?.value as
    | { data?: { estree?: { body?: { expression?: Node }[] } } }
    | undefined;
  const root = value?.data?.estree?.body?.[0]?.expression;
  if (!root) {
    issues.push(
      issue(file, line, `${name} needs literal image objects with src and alt.`)
    );
    return;
  }
  const objects =
    root.type === 'ArrayExpression' ? root.elements || [] : [root];
  if (objects.length === 0) {
    issues.push(
      issue(file, line, `${name} needs literal image objects with src and alt.`)
    );
  }
  objects.forEach((object, index) => {
    if (object.type !== 'ObjectExpression') {
      issues.push(
        issue(file, line, `${name}[${index}] needs a literal image object.`)
      );
      return;
    }
    const fields = new Map<string, Node>();
    for (const property of object.properties || []) {
      if (
        property.type !== 'Property' ||
        property.computed ||
        property.shorthand ||
        !property.key ||
        !['Identifier', 'Literal'].includes(property.key.type) ||
        !property.value ||
        (property.key.type === 'Literal' &&
          typeof property.key.value !== 'string')
      ) {
        issues.push(
          issue(file, line, `${name}[${index}] needs literal image fields.`)
        );
        return;
      }
      fields.set(
        String(property.key.name ?? property.key.value),
        property.value as Node
      );
    }
    const src = fields.get('src');
    const alt = fields.get('alt');
    const decorative = fields.get('decorative');
    if (!src) {
      issues.push(issue(file, line, `${name}[${index}] needs src.`));
      return;
    }
    const text =
      alt?.type === 'Literal' && typeof alt.value === 'string'
        ? alt.value
        : alt?.type === 'TemplateLiteral' && alt.expressions?.length === 0
          ? alt.quasis?.[0]?.value?.cooked
          : undefined;
    const message = imageAltIssue(
      text,
      decorative?.type === 'Literal' && decorative.value === true
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
  for (const collection of ['gallery', 'images', 'scenes', 'media']) {
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
