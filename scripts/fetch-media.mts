import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type DefaultTreeAdapterMap, parse } from 'parse5';

import {
  type MediaMention,
  getMediaMention,
  getMediaMentions,
} from '../lib/media';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
type ParentNode = DefaultTreeAdapterMap['parentNode'];
type Candidate = { source: string; alt: string; caption: string };

function* elements(node: ParentNode): Generator<Element> {
  for (const child of node.childNodes) {
    if (!('tagName' in child)) continue;
    yield child;
    yield* elements(child);
  }
}

function nodeText(node: Node): string {
  if ('value' in node) return node.value;
  return 'childNodes' in node ? node.childNodes.map(nodeText).join(' ') : '';
}

export function discoverImages(html: string, articleUrl: string): Candidate[] {
  const candidates = new Map<string, Candidate>();
  for (const node of elements(parse(html))) {
    const attrs = Object.fromEntries(
      node.attrs.map(({ name, value }) => [name, value])
    );
    let raw: string | undefined;
    if (node.tagName === 'img') raw = attrs.src;
    if (
      node.tagName === 'meta' &&
      ['og:image', 'twitter:image'].includes(attrs.property ?? attrs.name)
    ) {
      raw = attrs.content;
    }
    if (!raw) continue;
    let source: URL;
    try {
      source = new URL(raw, articleUrl);
    } catch {
      // A publisher's malformed image URL must not hide the other candidates.
      continue;
    }
    if (!['https:', 'http:'].includes(source.protocol)) continue;
    let parent = node.parentNode;
    while (parent && !('tagName' in parent && parent.tagName === 'figure')) {
      parent = 'parentNode' in parent ? parent.parentNode : null;
    }
    const previous = candidates.get(source.href);
    candidates.set(source.href, {
      source: source.href,
      alt: attrs.alt || previous?.alt || '',
      caption: parent
        ? nodeText(parent).replace(/\s+/g, ' ').trim()
        : previous?.caption || '',
    });
  }
  return [...candidates.values()];
}

export async function fetchBytes(url: string, limit: number) {
  if (!/^https?:\/\//.test(url))
    throw new Error('Expected an HTTP image source.');
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  if (!response.body) throw new Error(`${url}: empty response`);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > limit) throw new Error(`${url}: exceeds ${limit} bytes`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function fetchMentionImage(
  { id, url, image }: MediaMention,
  root = process.cwd()
) {
  if (!image?.source) {
    const bytes = await fetchBytes(url, 5_000_000);
    return discoverImages(bytes.toString(), url);
  }
  if (!image.credit) {
    throw new Error(`${id}: add image.credit before downloading.`);
  }
  if (
    !/^\/assets\/media\/[a-z0-9-]+\.(jpg|jpeg|png|webp|avif)$/.test(image.src)
  ) {
    throw new Error(`${id}: image.src must be a file under /assets/media/.`);
  }
  const bytes = await fetchBytes(image.source, 10_000_000);
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp =
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP';
  const avif = bytes.toString('ascii', 4, 12) === 'ftypavif';
  const extension = extname(image.src).slice(1);
  // Publisher MIME headers can be wrong, so the bytes determine the image format.
  const valid =
    (jpeg && ['jpg', 'jpeg'].includes(extension)) ||
    (png && extension === 'png') ||
    (webp && extension === 'webp') ||
    (avif && extension === 'avif');
  if (!valid)
    throw new Error(`${id}: response is not the expected image format.`);
  const destination = join(root, 'public', image.src);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
  return `${id}: saved ${image.src} (${bytes.length} bytes)`;
}

async function main() {
  const argument = process.argv[2];
  if (!argument) throw new Error('Usage: pnpm media:fetch <id|--all>');
  const mentions =
    argument === '--all'
      ? getMediaMentions({ includeDrafts: true }).filter(
          (mention) => mention.image?.source
        )
      : [getMediaMention(argument)];
  for (const mention of mentions) {
    try {
      console.log(await fetchMentionImage(mention));
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}
