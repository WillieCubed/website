import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** File order is retained; each domain owns slug rules and ordering. */
export function markdownFiles(
  dir: string,
  extensions: readonly string[] = ['.md', '.mdx'],
  missingIsEmpty = false
): string[] {
  if (missingIsEmpty && !existsSync(dir)) return [];
  return readdirSync(dir).filter(
    (file) =>
      !file.startsWith('_') &&
      extensions.some((extension) => file.endsWith(extension))
  );
}

/** Retain the caller's historical fallback policy and missing-file message. */
export function readMarkdownFile(
  dir: string,
  slug: string,
  missingMessage: string,
  policy: 'read' | 'exists' = 'read'
): { source: Buffer; filePath: string } {
  for (const extension of ['.mdx', '.md']) {
    const filePath = join(dir, slug + extension);
    if (policy === 'exists') {
      if (existsSync(filePath))
        return { source: readFileSync(filePath), filePath };
    } else {
      try {
        return { source: readFileSync(filePath), filePath };
      } catch {
        /* Existing writing loaders try the other extension on a read failure. */
      }
    }
  }
  throw new Error(missingMessage);
}
