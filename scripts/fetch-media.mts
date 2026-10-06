import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type DefaultTreeAdapterMap, parse } from 'parse5';

import {
  type MediaMention,
  getMediaMention,
  getMediaMentions,
  mediaImageSchema,
} from '../lib/media';
import { validateMediaImage } from './media-assets';

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

function* structuredImages(value: unknown): Generator<string> {
  if (typeof value === 'string') {
    yield value;
  } else if (Array.isArray(value)) {
    for (const item of value) yield* structuredImages(item);
  } else if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    for (const key of ['url', 'contentUrl']) {
      if (typeof object[key] === 'string') yield object[key];
    }
  }
}

function* articleImages(value: unknown): Generator<string> {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (['image', 'thumbnailUrl', 'promo_image'].includes(key)) {
      yield* structuredImages(child);
    } else {
      yield* articleImages(child);
    }
  }
}

export function discoverImages(html: string, articleUrl: string): Candidate[] {
  const nodes = [...elements(parse(html))];
  let base = articleUrl;
  const baseElement = nodes.find((node) => node.tagName === 'base');
  const href = baseElement?.attrs.find((attr) => attr.name === 'href')?.value;
  if (href) {
    try {
      base = new URL(href, articleUrl).href;
    } catch {
      // Invalid publisher markup must not hide the other candidates.
    }
  }
  const candidates = new Map<string, Candidate>();
  const add = (raw: string, alt = '', caption = '') => {
    let source: URL;
    try {
      source = new URL(raw, base);
    } catch {
      return;
    }
    if (!['https:', 'http:'].includes(source.protocol)) return;
    const previous = candidates.get(source.href);
    candidates.set(source.href, {
      source: source.href,
      alt: alt || previous?.alt || '',
      caption: caption || previous?.caption || '',
    });
  };
  for (const node of nodes) {
    const attrs = Object.fromEntries(
      node.attrs.map(({ name, value }) => [name, value])
    );
    if (node.tagName === 'img' || node.tagName === 'source') {
      let parent = node.parentNode;
      while (parent && !('tagName' in parent && parent.tagName === 'figure')) {
        parent = 'parentNode' in parent ? parent.parentNode : null;
      }
      const caption = parent
        ? nodeText(parent).replace(/\s+/g, ' ').trim()
        : '';
      for (const raw of [
        attrs.src,
        attrs['data-src'],
        attrs['data-original'],
      ]) {
        if (raw) add(raw, attrs.alt, caption);
      }
      for (const srcset of [attrs.srcset, attrs['data-srcset']]) {
        for (const entry of srcset?.split(',') ?? []) {
          const raw = entry.trim().split(/\s+/)[0];
          if (raw) add(raw, attrs.alt, caption);
        }
      }
    }
    if (node.tagName === 'video' && attrs.poster) add(attrs.poster);
    if (
      node.tagName === 'meta' &&
      ['og:image', 'twitter:image'].includes(attrs.property ?? attrs.name) &&
      attrs.content
    ) {
      add(attrs.content);
    }
    if (node.tagName === 'script') {
      const text = nodeText(node);
      // Arc publishes its article as JSON inside an assignment; never execute it.
      const json =
        attrs.type === 'application/ld+json'
          ? text
          : text.match(
              /Fusion\.globalContent\s*=\s*([\s\S]*?);\s*Fusion\.globalContentConfig\s*=/
            )?.[1];
      if (!json) continue;
      try {
        for (const raw of articleImages(JSON.parse(json))) add(raw);
      } catch {
        // One malformed metadata block must not discard HTML image candidates.
      }
    }
  }
  return [...candidates.values()];
}

export async function fetchResource(url: string, limit: number) {
  if (!/^https?:\/\//.test(url)) throw new Error('Expected an HTTP source.');
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
  return { bytes: Buffer.concat(chunks), url: response.url || url };
}

export async function discoverMentionImages({ url }: MediaMention) {
  const response = await fetchResource(url, 5_000_000);
  return discoverImages(response.bytes.toString(), response.url);
}

export async function fetchMentionImage(
  { id, image }: MediaMention,
  root = process.cwd()
) {
  if (!image) throw new Error(`${id}: select an image before downloading.`);
  const selected = mediaImageSchema.parse(image);
  const { bytes } = await fetchResource(selected.source, 10_000_000);
  await validateMediaImage(bytes, selected.src);
  const destination = join(root, 'public', selected.src);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await mkdir(dirname(destination), { recursive: true });
  try {
    await writeFile(temporary, bytes, { flag: 'wx' });
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
  return { id, src: selected.src, bytes: bytes.length };
}

async function main() {
  const [command, argument, ...extra] = process.argv.slice(2);
  if (
    !['discover', 'fetch'].includes(command) ||
    !argument ||
    extra.length ||
    (command === 'discover' && argument === '--all')
  ) {
    throw new Error(
      'Usage: pnpm media:discover <id> | pnpm media:fetch <id|--all>'
    );
  }
  const mentions =
    argument === '--all'
      ? getMediaMentions({ includeDrafts: true }).filter(
          (mention) => mention.image
        )
      : [getMediaMention(argument)];
  for (const mention of mentions) {
    try {
      if (command === 'discover') {
        console.log(
          JSON.stringify(await discoverMentionImages(mention), null, 2)
        );
      } else {
        const saved = await fetchMentionImage(mention);
        console.log(`${saved.id}: saved ${saved.src} (${saved.bytes} bytes)`);
      }
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
