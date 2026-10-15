import { type DefaultTreeAdapterMap, parseFragment, serialize } from 'parse5';

import { sanitizeCommentHtml } from '@/lib/indieweb/comment-content';
import { mediaMimeForUrl } from '@/lib/indieweb/media';
import type { ResponseMedia } from '@/lib/indieweb/webmention/types';

import { propertyText, propertyUrl } from './properties';
import type { WritingData } from './types';

type MediaKind = ResponseMedia['kind'];
type Element = DefaultTreeAdapterMap['element'];

function elementMediaKind(
  element: Element,
  parentMedia?: 'audio' | 'video'
): MediaKind | undefined {
  if (element.tagName === 'source') return parentMedia;
  switch (element.tagName) {
    case 'audio':
      return 'audio';
    case 'video':
      return 'video';
    case 'img':
      return 'image';
    case 'a':
      return 'file';
    default:
      return undefined;
  }
}

function mediaPropertyClass(kind: MediaKind): string {
  if (kind === 'file') return 'u-attachment';
  if (kind === 'image') return 'u-photo';
  return `u-${kind}`;
}

export function prepareWritingHtmlMedia(
  content: string,
  media: ResponseMedia[],
  base: string
): { html: string; attachments: ResponseMedia[] } {
  const represented = new Set<string>();
  const identity = (value: string) => {
    try {
      return new URL(value, base).href;
    } catch {
      return undefined;
    }
  };
  const original = parseFragment(content);
  function supplyMissingPhotoAlt(
    node: DefaultTreeAdapterMap['parentNode']
  ): void {
    for (const child of node.childNodes) {
      if (!('tagName' in child)) continue;
      if (
        child.tagName === 'img' &&
        !child.attrs.some((item) => item.name === 'alt')
      ) {
        const src = child.attrs.find((item) => item.name === 'src')?.value;
        const photo =
          src &&
          media.find(
            (item) =>
              item.kind === 'image' && identity(item.url) === identity(src)
          );
        if (photo && photo.description !== undefined)
          child.attrs.push({ name: 'alt', value: photo.description });
      }
      supplyMissingPhotoAlt(child);
    }
  }
  supplyMissingPhotoAlt(original);
  const fragment = parseFragment(
    sanitizeCommentHtml(serialize(original), base)
  );
  function markRepresentedMedia(
    child: Element,
    kind: MediaKind,
    url: string
  ): void {
    if (!media.some((item) => item.kind === kind && identity(item.url) === url))
      return;
    represented.add(`${kind}:${url}`);
    const propertyClass = mediaPropertyClass(kind);
    const classes = child.attrs.find((item) => item.name === 'class');
    if (classes) classes.value = propertyClass;
    else child.attrs.push({ name: 'class', value: propertyClass });
  }
  function visit(
    node: DefaultTreeAdapterMap['parentNode'],
    parentMedia?: 'audio' | 'video'
  ): void {
    for (const child of node.childNodes) {
      if (!('tagName' in child)) continue;
      const kind = elementMediaKind(child, parentMedia);
      const attribute = child.attrs.find(
        (item) => item.name === (kind === 'file' ? 'href' : 'src')
      );
      const url = attribute && identity(attribute.value);
      if (kind && url) markRepresentedMedia(child, kind, url);
      visit(
        child,
        child.tagName === 'audio' || child.tagName === 'video'
          ? child.tagName
          : undefined
      );
    }
  }
  visit(fragment);
  return {
    html: serialize(fragment),
    attachments: media.filter(
      (item) => !represented.has(`${item.kind}:${identity(item.url)}`)
    ),
  };
}

type AttachmentSource = Pick<WritingData, 'micropub' | 'audio' | 'video'>;
function attachmentValues(
  writing: AttachmentSource,
  property: 'audio' | 'video' | 'file' | 'attachment'
) {
  const supplied = writing.micropub?.properties[property];
  if (supplied != null) return supplied;
  if (property === 'audio') return writing.audio ?? [];
  if (property === 'video') return writing.video ?? [];
  return [];
}

function attachmentDescription(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  if (typeof item.alt === 'string') return item.alt || undefined;
  const properties = item.properties as Record<string, unknown[]> | undefined;
  return propertyText(properties?.name?.[0]) || undefined;
}

export function writingAttachments(
  writing: Pick<WritingData, 'micropub' | 'audio' | 'video'>
): ResponseMedia[] {
  const result: ResponseMedia[] = [];
  for (const [property, kind] of [
    ['audio', 'audio'],
    ['video', 'video'],
    ['file', 'file'],
    ['attachment', 'file'],
  ] as const) {
    const values = attachmentValues(writing, property);
    for (const value of values) {
      const url = propertyUrl(value);
      if (!url || result.some((item) => item.url === url)) continue;
      const description = attachmentDescription(value);
      result.push({
        kind,
        url,
        description: description || undefined,
        mimeType: mediaMimeForUrl(url, kind),
      });
    }
  }
  return result;
}

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!
  );
export function responseMediaHtml(
  media: ResponseMedia[],
  base: string
): string {
  return sanitizeCommentHtml(
    media
      .map((item) => {
        const body =
          item.kind === 'image'
            ? `<img src="${escape(item.url)}" alt="${escape(item.description || '')}">`
            : item.kind === 'file'
              ? `<a href="${escape(item.url)}">${escape(item.description || 'Attachment')}</a>`
              : `<${item.kind} src="${escape(item.url)}" controls preload="none"></${item.kind}>`;
        return `<figure>${body}${item.description && item.kind !== 'file' ? `<figcaption>${escape(item.description)}</figcaption>` : ''}</figure>`;
      })
      .join(''),
    base
  );
}
export function writingMediaHtml(
  writing: Pick<WritingData, 'micropub' | 'audio' | 'video' | 'photos'>,
  base: string,
  content = ''
): string {
  const media: ResponseMedia[] = [
    ...writingPhotoMedia(writing),
    ...writingAttachments(writing),
  ];
  const prepared = prepareWritingHtmlMedia(content, media, base);
  const appended = prepareWritingHtmlMedia(
    prepared.attachments
      .map((item) =>
        item.kind === 'image'
          ? `<img src="${escape(item.url)}" alt="${escape(item.description || '')}">`
          : responseMediaHtml([item], base)
      )
      .join(''),
    prepared.attachments,
    base
  );
  return prepared.html + appended.html;
}

export function writingPhotoMedia(
  writing: Pick<WritingData, 'photos'>
): ResponseMedia[] {
  return (
    writing.photos?.map((photo) => ({
      kind: 'image',
      url: photo.url,
      description: photo.alt,
      mimeType: mediaMimeForUrl(photo.url),
    })) ?? []
  );
}
