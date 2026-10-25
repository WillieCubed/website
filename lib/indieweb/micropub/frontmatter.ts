import matter from 'gray-matter';

import type {
  Block,
  Frontmatter,
  WritingFile,
} from '@/lib/indieweb/micropub/document-types';
import { MicropubRequestError } from '@/lib/indieweb/micropub/document-types';

// Passing options keeps gray-matter from caching the parse, which would hand
// every caller one shared data object.
export function readWritingSource(source: string): {
  data: Frontmatter;
  content: string;
} {
  const { data, content } = matter(source, {});
  return { data: data as Frontmatter, content };
}
const FRONTMATTER = /^(---[ \t]*(\r?\n))((?:[^\n]*\n)*?)(---[ \t]*(?:\r?\n|$))/;
export function splitWritingFile(source: string): WritingFile {
  const match = FRONTMATTER.exec(source);
  if (!match) {
    throw new MicropubRequestError('The post has no frontmatter to edit.');
  }
  const [whole, open, eol, frontmatter, close] = match;
  return {
    open,
    blocks: frontmatterBlocks(frontmatter.match(/[^\n]*\n/g) ?? []),
    close,
    body: source.slice(whole.length),
    eol,
  };
}
/**
 * Split frontmatter into one block per top-level key, with its indented or
 * list lines, and a block per comment or blank line between them. A blank
 * line inside a block scalar stays with its key.
 */
function frontmatterBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let blanks: string[] = [];
  const flush = () => {
    blocks.push(...blanks.map((line) => ({ lines: [line] })));
    blanks = [];
  };
  for (const line of lines) {
    const content = line.replace(/\r?\n$/, '');
    const key = /^([A-Za-z_][\w-]*)[ \t]*:(?:[ \t]|$)/.exec(content)?.[1];
    const last = blocks.at(-1);
    if (key) {
      flush();
      blocks.push({ key, lines: [line] });
    } else if (content.trim() === '') {
      blanks.push(line);
    } else if (/^[ \t-]/.test(content) && last?.key) {
      last.lines.push(...blanks, line);
      blanks = [];
    } else {
      flush();
      blocks.push({ lines: [line] });
    }
  }
  flush();
  return blocks;
}
export function joinWritingFile({
  open,
  blocks,
  close,
  body,
}: WritingFile): string {
  return `${open}${blocks.flatMap((block) => block.lines).join('')}${close}${body}`;
}
/** Replace a key's lines where they are, append a new key, or remove it. */
export function setKey(file: WritingFile, key: string, lines: string[] | null) {
  const index = file.blocks.findIndex((block) => block.key === key);
  if (lines === null) {
    if (index !== -1) file.blocks.splice(index, 1);
    return;
  }
  const block = { key, lines: lines.map((line) => `${line}${file.eol}`) };
  if (index !== -1) file.blocks[index] = block;
  else file.blocks.push(block);
}

export function mapList(key: string, items: object[]) {
  if (items.length === 0) return null;
  return [
    `${key}:`,
    ...items.flatMap((item) =>
      Object.entries(item)
        .filter(([, value]) => value !== undefined)
        .map(
          ([field, value], index) =>
            `${index === 0 ? '  - ' : '    '}${field}: ${JSON.stringify(value)}`
        )
    ),
  ];
}
