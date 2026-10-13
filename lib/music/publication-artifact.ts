import { createHash } from 'node:crypto';

import { publicCatalog } from './schema';
import type { MusicCatalog } from './types';

export function musicArtifact(revisionId: string, catalog: MusicCatalog) {
  if (!/^[a-f0-9-]{36}$/.test(revisionId))
    throw new Error('Invalid Music revision.');
  const content =
    JSON.stringify({ revisionId, catalog: publicCatalog(catalog) }, null, 2) +
    '\n';
  return {
    path: 'content/music/catalog.json',
    content,
    sha: createHash('sha1')
      .update(`blob ${Buffer.byteLength(content)}\0`)
      .update(content)
      .digest('hex'),
  };
}
export function matchesMusicProof(
  publication: { revisionId: string; sourceSha?: string; commit?: string },
  proof: { revisionId?: string; sourceSha?: string; commit?: string },
  ancestor = false
) {
  return Boolean(
    publication.sourceSha &&
    publication.commit &&
    proof.revisionId === publication.revisionId &&
    proof.sourceSha === publication.sourceSha &&
    (proof.commit === publication.commit || ancestor)
  );
}
