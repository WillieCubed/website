import { type DefaultTreeAdapterMap, parseFragment } from 'parse5';

import { sanitizeCommentHtml } from '@/lib/indieweb/comment-content';
import { stripMdxSyntax } from '@/lib/text/strip-mdx';

import { writingAttachments } from './media';
import type { WritingData } from './types';

export function htmlText(html: string): string {
  const fragment = parseFragment(
    sanitizeCommentHtml(html, 'https://example.invalid/')
  );
  function text(node: DefaultTreeAdapterMap['node']): string {
    if (node.nodeName === '#text' && 'value' in node) return node.value;
    if (!('childNodes' in node)) return '';
    const description =
      'attrs' in node
        ? (node.attrs.find((attr) => attr.name === 'alt')?.value ?? '')
        : '';
    const body = node.childNodes.map(text).join('');
    return `${description ? `\n${description}\n` : ''}${body}${'tagName' in node && ['td', 'th'].includes(node.tagName) ? '\t' : ''}${'tagName' in node && ['p', 'div', 'pre', 'li', 'tr', 'blockquote', 'figcaption', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tagName) ? '\n' : ''}`;
  }
  return text(fragment)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
export function writingText(
  content: string,
  writing: Pick<
    WritingData,
    'contentFormat' | 'photos' | 'micropub' | 'audio' | 'video'
  >
): string {
  const body =
    writing.contentFormat === 'text'
      ? content.trim()
      : writing.contentFormat === 'html'
        ? htmlText(content)
        : stripMdxSyntax(content);
  return [
    body,
    ...(writing.photos?.map((photo) => photo.alt) ?? []),
    ...writingAttachments(writing).map((media) => media.description),
  ]
    .filter(Boolean)
    .join('\n\n');
}
export function plainTextHtml(text: string): string {
  const escaped = text.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!
  );
  return `<p dir="auto">${escaped.replace(/\n/g, '<br>')}</p>`;
}
