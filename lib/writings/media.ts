import { sanitizeCommentHtml } from '@/lib/indieweb/comment-content';
import { mediaMimeForUrl } from '@/lib/indieweb/media';
import type { ResponseMedia } from '@/lib/indieweb/types';

import { propertyText, propertyUrl } from './properties';
import type { WritingData } from './types';

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
export function writingMediaHtml(writing: WritingData, base: string): string {
  const photos =
    writing.photos?.map(
      (photo) =>
        `<img class="u-photo" src="${escape(photo.url)}" alt="${escape(photo.alt)}">`
    ) ?? [];
  return (
    sanitizeCommentHtml(photos.join('\n'), base) +
    responseMediaHtml(writingAttachments(writing), base)
  );
}
