import { stripMdxSyntax } from '@/lib/text/strip-mdx';

import { writingAttachments } from './media';
import type { WritingData } from './types';

export function writingText(
  content: string,
  writing: Pick<WritingData, 'photos' | 'micropub' | 'audio' | 'video'>
): string {
  return [
    stripMdxSyntax(content),
    ...(writing.photos?.map((photo) => photo.alt) ?? []),
    ...writingAttachments(writing).map((media) => media.description),
  ]
    .filter(Boolean)
    .join('\n\n');
}
