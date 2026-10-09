import { fileTypeFromBuffer } from 'file-type';
import { mf2 } from 'microformats-parser';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import {
  fetchPublicBytes,
  fetchPublicDocument,
} from '../lib/indieweb/public-fetch';

interface Manifest {
  feedUrl: string;
  itemUrl: string;
  title: string;
  published: string;
  updated?: string;
  author: { name: string; url: string };
  attachments: {
    url: string;
    mimeType: string;
    uploadedFile: string;
    jsonAttachment: boolean;
  }[];
}

const ORIGIN = 'https://indieweb-acceptance.vercel.app';
const MAX_BYTES = 4 * 1024 * 1024;
const sha256 = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
let phase = 'manifest validation';
let failurePath: string | undefined;

async function main() {
  const { values } = parseArgs({
    options: {
      manifest: { type: 'string' },
      output: { type: 'string' },
    },
  });
  assert(values.manifest && values.output, 'Use --manifest and --output.');
  const manifestPath = resolve(values.manifest);
  const manifest: Manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(manifest.feedUrl, `${ORIGIN}/writings/feed/json`);
  assert.equal(new URL(manifest.itemUrl).origin, ORIGIN);
  assert(new URL(manifest.itemUrl).pathname.startsWith('/writings/'));
  assert.equal(manifest.author.url, `${ORIGIN}/`);
  assert.equal(new Date(manifest.published).toISOString(), manifest.published);
  if (manifest.updated)
    assert.equal(new Date(manifest.updated).toISOString(), manifest.updated);
  assert.deepEqual(
    [
      ...new Set(
        manifest.attachments.map(
          (attachment) => attachment.mimeType.split('/')[0]
        )
      ),
    ].sort(),
    ['application', 'audio', 'image', 'video']
  );
  const output = resolve(values.output);
  const outputRelative = relative(resolve('.playwright-mcp'), output);
  assert(
    outputRelative &&
      !outputRelative.startsWith('..') &&
      !outputRelative.startsWith('/')
  );
  failurePath = `${output}.failure.json`;
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  phase = 'deployed JSON Feed retrieval';
  const response = await fetchPublicDocument(manifest.feedUrl, {
    timeoutMs: 10000,
  });
  assert(
    response && response.status === 200,
    'The live feed did not return 200.'
  );
  await writeFile(
    `${output}.feed.json`,
    JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        url: manifest.feedUrl,
        status: response.status,
        body: response.body,
      },
      null,
      2
    ) + '\n',
    { mode: 0o600, flag: 'wx' }
  );
  phase = 'JSON Feed identity and canonical item';
  const feed = JSON.parse(response.body);
  assert.equal(feed.version, 'https://jsonfeed.org/version/1.1');
  assert.equal(feed.feed_url, manifest.feedUrl);
  assert.equal(feed.home_page_url, `${ORIGIN}/writings`);
  assert.deepEqual(feed.authors, [manifest.author]);
  const matches = feed.items.filter(
    (item: { url?: string }) => item.url === manifest.itemUrl
  );
  assert.equal(
    matches.length,
    1,
    'The live feed must contain one canonical fixture item.'
  );
  const item = matches[0];
  assert.equal(item.id, manifest.itemUrl);
  assert.equal(item.title, manifest.title);
  assert.equal(item.date_published, manifest.published);
  assert.equal(item.date_modified, manifest.updated);
  assert.deepEqual(item.authors ?? feed.authors, [manifest.author]);
  assert.equal(typeof item.content_html, 'string');
  assert(item.content_html.length > 0);
  assert.equal(
    item.attachments.length,
    manifest.attachments.filter((media) => media.jsonAttachment).length
  );
  const parsedContent = mf2(
    `<article class="h-entry">${item.content_html}</article>`,
    { baseUrl: manifest.itemUrl }
  ).items[0];
  const media = [];
  for (const expected of manifest.attachments) {
    phase = `JSON content and attachment metadata for ${expected.mimeType}`;
    const url = new URL(expected.url);
    assert.equal(url.protocol, 'https:');
    assert(!url.username && !url.password);
    assert.equal(typeof expected.jsonAttachment, 'boolean');
    assert(expected.jsonAttachment || expected.mimeType.startsWith('image/'));
    const property = expected.mimeType.startsWith('image/')
      ? 'photo'
      : expected.mimeType.startsWith('audio/')
        ? 'audio'
        : expected.mimeType.startsWith('video/')
          ? 'video'
          : 'attachment';
    const contentMedia = (parsedContent.properties[property] ?? []).map(
      (value) =>
        typeof value === 'string'
          ? value
          : 'value' in value
            ? value.value
            : undefined
    );
    assert(contentMedia.includes(expected.url));
    const attachments = item.attachments.filter(
      (attachment: { url?: string }) => attachment.url === expected.url
    );
    assert.equal(attachments.length, expected.jsonAttachment ? 1 : 0);
    const uploaded = await readFile(
      resolve(dirname(manifestPath), expected.uploadedFile)
    );
    assert(uploaded.length > 0 && uploaded.length <= MAX_BYTES);
    assert.equal((await fileTypeFromBuffer(uploaded))?.mime, expected.mimeType);
    if (expected.jsonAttachment) {
      assert.equal(attachments[0].mime_type, expected.mimeType);
      assert.equal(attachments[0].size_in_bytes, uploaded.length);
    }
    phase = `public byte retrieval and SHA256 for ${expected.mimeType}`;
    const downloaded = await fetchPublicBytes(expected.url, MAX_BYTES);
    assert(downloaded, 'The actual public media could not be downloaded.');
    assert.equal(downloaded.mimeType, expected.mimeType);
    assert.equal(sha256(downloaded.bytes), sha256(uploaded));
    media.push({
      url: expected.url,
      mimeType: expected.mimeType,
      bytes: uploaded.length,
      sha256: sha256(uploaded),
      matchesUploadedBytes: true,
      jsonAttachment: expected.jsonAttachment,
      contentProperty: property,
    });
  }
  const receipt = {
    at: new Date().toISOString(),
    kind: 'Independent read-only parsing of deployed JSON Feed and public media hash comparison against the exact locally retained upload bytes.',
    feedUrl: manifest.feedUrl,
    canonicalItemUrl: manifest.itemUrl,
    feedSha256: sha256(Buffer.from(response.body)),
    verified: {
      author: manifest.author,
      title: manifest.title,
      published: manifest.published,
      updated: manifest.updated,
      contentHtmlPresent: true,
    },
    media,
    result: 'passed',
    writes:
      'Receipt only. No posts, uploads, grants, database changes or deployments.',
  };
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  await writeFile(output, JSON.stringify(receipt, null, 2) + '\n', {
    mode: 0o600,
    flag: 'wx',
  });
  console.log(
    'The live JSON Feed fields and exact uploaded media hashes passed.'
  );
  console.log(`Receipt: ${output}`);
}

main().catch(async (error) => {
  if (failurePath) {
    await writeFile(
      failurePath,
      JSON.stringify(
        {
          observedAt: new Date().toISOString(),
          phase,
          name: error instanceof Error ? error.name : 'UnknownError',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        null,
        2
      ) + '\n',
      { mode: 0o600, flag: 'wx' }
    ).catch(() => {});
  }
  console.error(
    'The read-only live feed/media verification failed. No credentials were printed.'
  );
  process.exitCode = 1;
});
