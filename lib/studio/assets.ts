import type { R2Bucket } from '@cloudflare/workers-types';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { randomUUID } from 'node:crypto';

import { MEDIA_TYPES } from '@/lib/indieweb/media';

import { StudioError } from './errors';
import { getStudioPool } from './store';
import type { DraftContent, UploadedStudioAsset } from './types';

function privateBucket(): R2Bucket {
  try {
    const bucket = getCloudflareContext().env.STUDIO_PRIVATE_BUCKET;
    if (bucket) return bucket;
  } catch {
    // Local development has no R2 bindings.
  }
  throw new StudioError(503, 'Private media storage is not configured.');
}

function publishedBucket(): R2Bucket {
  try {
    const { STUDIO_PUBLIC_MEDIA_BUCKET, MEDIA_BUCKET } =
      getCloudflareContext().env;
    const bucket = STUDIO_PUBLIC_MEDIA_BUCKET ?? MEDIA_BUCKET;
    if (bucket) return bucket;
  } catch {
    // Local development has no R2 bindings.
  }
  throw new StudioError(503, 'Published media storage is not configured.');
}

export async function uploadAsset(file: File): Promise<UploadedStudioAsset> {
  if (!MEDIA_TYPES[file.type] || file.size === 0 || file.size > 4_000_000)
    throw new StudioError(400, 'Choose an image smaller than 4 MB.');
  const id = randomUUID();
  const pathname = `studio/${id}.${MEDIA_TYPES[file.type]}`;
  const bucket = privateBucket();
  await bucket.put(pathname, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });
  try {
    await getStudioPool().query(
      'INSERT INTO studio_assets(id,pathname,content_type,original_name) VALUES($1,$2,$3,$4)',
      [id, pathname, file.type, file.name]
    );
  } catch (error) {
    await bucket.delete(pathname);
    throw error;
  }
  return { id, url: `/api/studio/assets/${id}` };
}

export async function readAsset(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id))
    throw new StudioError(404, 'Image not found.');
  const record = (
    await getStudioPool().query('SELECT * FROM studio_assets WHERE id=$1', [id])
  ).rows[0];
  if (!record) throw new StudioError(404, 'Image not found.');
  const value = await privateBucket().get(record.pathname);
  if (!value) throw new StudioError(404, 'Image not found.');
  return {
    bytes: await value.arrayBuffer(),
    contentType: record.content_type as string,
  };
}

export async function promoteAssets(
  body: DraftContent,
  publicationId: string
): Promise<DraftContent> {
  let serialized = JSON.stringify(body);
  const ids = [
    ...new Set(
      Array.from(
        serialized.matchAll(/\/api\/studio\/assets\/([a-f0-9-]{36})/g),
        (m) => m[1]
      )
    ),
  ];
  for (const id of ids) {
    const existing = (
      await getStudioPool().query(
        'SELECT public_url FROM studio_asset_promotions WHERE publication_id=$1 AND asset_id=$2',
        [publicationId, id]
      )
    ).rows[0];
    let url = existing?.public_url as string | undefined;
    if (!url) {
      const asset = await readAsset(id);
      const extension = MEDIA_TYPES[asset.contentType];
      if (!extension) throw new StudioError(400, 'Unsupported image type.');
      const key = `media/writings/${publicationId}/${id}.${extension}`;
      await publishedBucket().put(key, asset.bytes, {
        httpMetadata: { contentType: asset.contentType },
      });
      url = new URL(
        `/${key}`,
        process.env.STUDIO_PUBLIC_ORIGIN || 'https://willie.page'
      ).href;
      await getStudioPool().query(
        'INSERT INTO studio_asset_promotions(publication_id,asset_id,public_url) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
        [publicationId, id, url]
      );
    }
    serialized = serialized.replace(
      new RegExp(`(?:https?:[^"\\s]+)?/api/studio/assets/${id}`, 'g'),
      url
    );
  }
  return JSON.parse(serialized);
}
