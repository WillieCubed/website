import type { WritingData } from '@/lib/writings';

type Shareable = Pick<
  WritingData,
  'title' | 'description' | 'hasExplicitTitle'
>;

/** An article is shared by its headline; a note by its own words. */
function shareText(writing: Shareable): string {
  return writing.hasExplicitTitle ? writing.title : writing.description;
}

export function threadsPostIntent(
  writing: Shareable,
  originalUrl: string
): string {
  const intent = new URL('https://www.threads.com/intent/post');
  intent.searchParams.set('text', shareText(writing));
  intent.searchParams.set('url', originalUrl);
  return intent.toString();
}

/**
 * Bluesky's compose intent takes only text, so the URL rides at the end,
 * where the composer turns it into a link card.
 */
export function blueskyPostIntent(
  writing: Shareable,
  originalUrl: string
): string {
  const intent = new URL('https://bsky.app/intent/compose');
  intent.searchParams.set('text', `${shareText(writing)}\n\n${originalUrl}`);
  return intent.toString();
}
