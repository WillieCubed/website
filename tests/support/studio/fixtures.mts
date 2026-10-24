import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Pool, PoolClient } from 'pg';

export async function seedStudioDatabase(
  db: Pool,
  schema: string,
  music = Boolean(process.env.MUSIC_E2E)
): Promise<void> {
  await db.query(`CREATE SCHEMA ${schema}`);
  const client = await db.connect();
  try {
    await client.query(`SET search_path TO ${schema}`);
    for (const file of ['005_studio.sql', '006_studio_lattice.sql'])
      await client.query(
        await readFile(
          new URL(`../../../lib/db/migrations/${file}`, import.meta.url),
          'utf8'
        )
      );
    if (music) await seedMusicFixtures(client);
    const id = randomUUID(),
      revision = randomUUID();
    await client.query('INSERT INTO studio_documents(id,slug) VALUES($1,$2)', [
      id,
      'a-place-to-begin',
    ]);
    await client.query(
      'INSERT INTO studio_revisions(id,document_id,number,body) VALUES($1,$2,1,$3)',
      [
        revision,
        id,
        JSON.stringify({
          title: 'A place to begin',
          description: 'A private page for a new thought.',
          postType: 'article',
          tags: ['Ideas'],
          document: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'A thought worth keeping.' }],
              },
            ],
          },
        }),
      ]
    );
    await client.query('UPDATE studio_documents SET head_id=$1 WHERE id=$2', [
      revision,
      id,
    ]);
  } finally {
    client.release();
  }
}

async function seedMusicFixtures(client: PoolClient): Promise<void> {
  for (const scope of ['private', 'public'])
    await client.query(
      await readFile(
        new URL(`../../../lib/music/migrations/${scope}.sql`, import.meta.url),
        'utf8'
      )
    );
  const approved: { catalog: { selected: string[] } } = JSON.parse(
    await readFile(
      new URL('../../../content/music/catalog.json', import.meta.url),
      'utf8'
    )
  );
  for (const [index, title] of [
    'A long playlist title that preserves the sequence across several evenings',
    'Summer in the city',
    'An empty collection',
  ].entries()) {
    const playlist = {
      id: String(index + 1).repeat(22),
      title,
      description: '',
      image: null,
      url: `https://open.spotify.com/playlist/${String(index + 1).repeat(22)}`,
      ownerId: 'music-test',
      eligible: true,
      snapshot: 'test',
      tracks:
        index === 2
          ? []
          : [
              {
                title: 'First track',
                artist: 'Test artist',
                duration: '3:12',
                durationMs: 192000,
                kind: 'track',
                url: null,
              },
              {
                title: 'Unavailable track',
                artist: '',
                duration: '–',
                durationMs: null,
                kind: 'unavailable',
                unavailable: true,
                url: null,
              },
            ],
      trackCount: index === 2 ? 0 : 2,
      checkedAt: new Date().toISOString(),
      error: null,
    };
    await client.query(
      'INSERT INTO music_provider_cache(id,body,checked_at,eligible) VALUES($1,$2,now(),true)',
      [playlist.id, JSON.stringify(playlist)]
    );
    const publicId = approved.catalog.selected[index];
    if (publicId) {
      const publicPlaylist = {
        ...playlist,
        id: publicId,
        url: `https://open.spotify.com/playlist/${publicId}`,
      };
      await client.query(
        'INSERT INTO music_approved_cache(id,body,checked_at,eligible) VALUES($1,$2,now(),true)',
        [publicId, JSON.stringify(publicPlaylist)]
      );
    }
  }
  await client.query(
    "INSERT INTO music_connections(singleton,owner_id,encrypted_grant) VALUES(true,'music-test','not-used-for-provider-tests')"
  );
}
