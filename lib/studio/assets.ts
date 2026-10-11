import { get, put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';

import { MEDIA_TYPES } from '@/lib/indieweb/media';

import { StudioError } from './errors';
import { getStudioPool } from './store';
import type { DraftContent } from './types';

function privateToken() {
  if (!process.env.STUDIO_BLOB_READ_WRITE_TOKEN)
    throw new StudioError(503, 'Private media storage is not configured.');
  return process.env.STUDIO_BLOB_READ_WRITE_TOKEN;
}

export async function uploadAsset(
  file: File
): Promise<{ id: string; url: string }> {
  if (!MEDIA_TYPES[file.type] || file.size === 0 || file.size > 4_000_000)
    throw new StudioError(400, 'Choose an image smaller than 4 MB.');
  const id = randomUUID();
  const pathname = `studio/${id}.${MEDIA_TYPES[file.type]}`;
  const value = await put(pathname, file, {
    token: privateToken(),
    access: 'private',
    addRandomSuffix: false,
    contentType: file.type,
  });
  await getStudioPool().query(
    'INSERT INTO studio_assets(id,pathname,content_type,original_name) VALUES($1,$2,$3,$4)',
    [id, value.pathname, file.type, file.name]
  );
  return { id, url: `/api/studio/assets/${id}` };
}

export async function readAsset(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id))
    throw new StudioError(404, 'Image not found.');
  const record = (
    await getStudioPool().query('SELECT * FROM studio_assets WHERE id=$1', [id])
  ).rows[0];
  if (!record) throw new StudioError(404, 'Image not found.');
  const value = await get(record.pathname, {
    token: privateToken(),
    access: 'private',
    useCache: false,
  });
  if (!value || value.statusCode !== 200)
    throw new StudioError(404, 'Image not found.');
  return { stream: value.stream, contentType: record.content_type as string };
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
    let url = existing?.public_url;
    if (!url) {
      if (!process.env.STUDIO_PUBLIC_BLOB_READ_WRITE_TOKEN)
        throw new StudioError(
          503,
          'Published media storage is not configured.'
        );
      const asset = await readAsset(id);
      const value = await put(
        `writings/${publicationId}/${id}.${MEDIA_TYPES[asset.contentType]}`,
        asset.stream,
        {
          token: process.env.STUDIO_PUBLIC_BLOB_READ_WRITE_TOKEN,
          access: 'public',
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: asset.contentType,
        }
      );
      url = value.url;
      await getStudioPool().query(
        'INSERT INTO studio_asset_promotions(publication_id,asset_id,public_url) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
        [publicationId, id, url]
      );
    }
    // Match the optional preview origin too; the final source has public URLs only.
    serialized = serialized.replace(
      new RegExp(`(?:https?:[^"\\s]+)?/api/studio/assets/${id}`, 'g'),
      url
    );
  }
  return JSON.parse(serialized);
}
