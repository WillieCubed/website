import { propertyText, propertyUrl } from './properties';
import type { WritingData } from './types';

export function writingAttachments(
  writing: Pick<WritingData, 'micropub' | 'audio' | 'video'>
) {
  const result: {
    kind: 'audio' | 'video' | 'file';
    url: string;
    description?: string;
  }[] = [];
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
      });
    }
  }
  return result;
}
