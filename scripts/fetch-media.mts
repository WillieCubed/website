import matter from 'gray-matter';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type DefaultTreeAdapterMap, parse } from 'parse5';

type Node = DefaultTreeAdapterMap['node'];
type Candidate = { source: string; alt: string; caption: string };

function attribute(node: Node, name: string) {
  return 'attrs' in node
    ? node.attrs.find((attribute) => attribute.name === name)?.value
    : undefined;
}

function nodeText(node: Node): string {
  if ('value' in node) return node.value;
  return 'childNodes' in node ? node.childNodes.map(nodeText).join(' ') : '';
}

export function discoverImages(html: string, articleUrl: string): Candidate[] {
  const candidates = new Map<string, Candidate>();
  function visit(node: Node) {
    const isImage = 'tagName' in node && node.tagName === 'img';
    const isPreview =
      'tagName' in node &&
      node.tagName === 'meta' &&
      ['og:image', 'twitter:image'].includes(
        attribute(node, 'property') ?? attribute(node, 'name') ?? ''
      );
    const raw = isImage
      ? attribute(node, 'src')
      : isPreview
        ? attribute(node, 'content')
        : undefined;
    if (raw) {
      try {
        const source = new URL(raw, articleUrl);
        if (['https:', 'http:'].includes(source.protocol)) {
          let parent = 'parentNode' in node ? node.parentNode : null;
          while (
            parent &&
            !('tagName' in parent && parent.tagName === 'figure')
          ) {
            parent = 'parentNode' in parent ? parent.parentNode : null;
          }
          const previous = candidates.get(source.href);
          candidates.set(source.href, {
            source: source.href,
            alt: attribute(node, 'alt') || previous?.alt || '',
            caption: parent
              ? nodeText(parent).replace(/\s+/g, ' ').trim()
              : previous?.caption || '',
          });
        }
      } catch {
        // A publisher's malformed image URL must not hide the other candidates.
      }
    }
    if ('childNodes' in node) node.childNodes.forEach(visit);
  }
  visit(parse(html));
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
  return {
    bytes: Buffer.concat(chunks),
    type: response.headers.get('content-type')?.split(';')[0],
  };
}

export async function fetchMentionImage(id: string, root = process.cwd()) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error('Expected a media content filename without .md.');
  }
  const { data } = matter(
    await readFile(join(root, 'content/media', `${id}.md`), 'utf8')
  );
  if (!data.image?.source) {
    const { bytes } = await fetchBytes(data.url, 5_000_000);
    return discoverImages(bytes.toString(), data.url);
  }
  if (!data.image.alt?.trim() || !data.image.credit?.trim()) {
    throw new Error(
      `${id}: add image.alt and image.credit before downloading.`
    );
  }
  if (
    !/^\/assets\/media\/[a-z0-9-]+\.(jpg|jpeg|png|webp|avif)$/.test(
      data.image.src
    )
  ) {
    throw new Error(`${id}: image.src must be a file under /assets/media/.`);
  }
  const { bytes, type } = await fetchBytes(data.image.source, 10_000_000);
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp =
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP';
  const avif = bytes.toString('ascii', 4, 12) === 'ftypavif';
  const extension = data.image.src.split('.').at(-1);
  // Some publisher CDNs mislabel PNGs as JPEGs; verify the bytes and local suffix.
  const valid =
    ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(
      type ?? ''
    ) &&
    ((jpeg && ['jpg', 'jpeg'].includes(extension)) ||
      (png && extension === 'png') ||
      (webp && extension === 'webp') ||
      (avif && extension === 'avif'));
  if (!valid)
    throw new Error(`${id}: response is not the expected image format.`);
  const destination = join(root, 'public', data.image.src);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
  return `${id}: saved ${data.image.src} (${bytes.length} bytes)`;
}

async function main() {
  const argument = process.argv[2];
  if (!argument) throw new Error('Usage: pnpm media:fetch <id|--all>');
  const ids =
    argument === '--all'
      ? (await readdir('content/media'))
          .filter((file) => file.endsWith('.md') && !file.startsWith('_'))
          .map((file) => file.slice(0, -3))
      : [argument];
  for (const id of ids) {
    if (argument === '--all') {
      const { data } = matter(await readFile(`content/media/${id}.md`, 'utf8'));
      if (!data.image?.source) continue;
    }
    try {
      console.log(await fetchMentionImage(id));
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
