import type { WritingData } from '@/lib/writings';

export function threadsPostIntent(
  writing: Pick<WritingData, 'title' | 'description' | 'hasExplicitTitle'>,
  originalUrl: string
): string {
  const intent = new URL('https://www.threads.com/intent/post');
  intent.searchParams.set(
    'text',
    writing.hasExplicitTitle ? writing.title : writing.description
  );
  intent.searchParams.set('url', originalUrl);
  return intent.toString();
}
