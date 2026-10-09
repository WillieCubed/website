import { type DefaultTreeAdapterMap, parseFragment, serialize } from 'parse5';

import { sanitizeCommentHtml } from '@/lib/indieweb/comment-content';
import { mediaMimeForUrl } from '@/lib/indieweb/media';
import type { ResponseMedia } from '@/lib/indieweb/types';

import { propertyText, propertyUrl } from './properties';
import type { WritingData } from './types';

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
  function visit(
    node: DefaultTreeAdapterMap['parentNode'],
    parentMedia?: 'audio' | 'video'
  ): void {
    for (const child of node.childNodes) {
      if (!('tagName' in child)) continue;
      const kind =
        child.tagName === 'audio' || child.tagName === 'video'
          ? child.tagName
          : child.tagName === 'source'
            ? parentMedia
            : child.tagName === 'img'
              ? 'image'
              : child.tagName === 'a'
                ? 'file'
                : undefined;
      const attribute = child.attrs.find(
        (item) => item.name === (kind === 'file' ? 'href' : 'src')
      );
      const url = attribute && identity(attribute.value);
      if (
        kind &&
        url &&
        media.some((item) => item.kind === kind && identity(item.url) === url)
      ) {
        represented.add(`${kind}:${url}`);
        const propertyClass =
          kind === 'file'
            ? 'u-attachment'
            : kind === 'image'
              ? 'u-photo'
              : `u-${kind}`;
        const classes = child.attrs.find((item) => item.name === 'class');
        if (classes) classes.value = propertyClass;
        else child.attrs.push({ name: 'class', value: propertyClass });
      }
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
    const supplied = writing.micropub?.properties[property];
    const values =
      supplied ??
      (property === 'audio'
        ? writing.audio
        : property === 'video'
          ? writing.video
          : []) ??
      [];
    for (const value of values) {
      const url = propertyUrl(value);
      if (!url || result.some((item) => item.url === url)) continue;
      const item = typeof value === 'object' ? value : undefined;
      const description =
        item &&
        (typeof item.alt === 'string'
          ? item.alt
          : propertyText(
              (item.properties as Record<string, unknown[]> | undefined)
                ?.name?.[0]
            ));
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
