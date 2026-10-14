import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { type Server, createServer } from 'node:http';
import { userInfo } from 'node:os';
import { Pool } from 'pg';

import { isMain } from '../publishing/runtime.mts';

export async function runStudioTests() {
  const port = Number(process.env.STUDIO_TEST_PORT || 3217);
  const origin = `http://localhost:${port}`;
  const schema = `studio_e2e_${randomUUID().replaceAll('-', '')}`;
  const db = new Pool({ host: '/tmp', database: 'postgres' });
  let server: Server | undefined;
  let next: ChildProcess | undefined;
  let runningTests: ChildProcess | undefined;
  let cleaning = false;
  async function cleanup() {
    if (cleaning) return;
    cleaning = true;
    if (runningTests?.pid) {
      try {
        process.kill(-runningTests.pid, 'SIGTERM');
      } catch {
        /* Test runner may have stopped already. */
      }
    }
    if (next?.pid) {
      try {
        process.kill(-next.pid, 'SIGTERM');
      } catch {
        /* Process or server may have already stopped. */
      }
    }
    if (server)
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => (error ? reject(error) : resolve()))
      );
    await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await db.end();
  }
  process.once('SIGINT', async () => {
    await cleanup();
    process.exit(130);
  });
  process.once('SIGTERM', async () => {
    await cleanup();
    process.exit(143);
  });
  try {
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
      if (process.env.MUSIC_E2E) {
        for (const scope of ['private', 'public'])
          await client.query(
            await readFile(
              new URL(
                `../../../lib/music/migrations/${scope}.sql`,
                import.meta.url
              ),
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
      const id = randomUUID(),
        revision = randomUUID();
      await client.query(
        'INSERT INTO studio_documents(id,slug) VALUES($1,$2)',
        [id, 'a-place-to-begin']
      );
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
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = {
      ...(await exportJWK(publicKey)),
      kid: 'studio-e2e',
      alg: 'RS256',
      use: 'sig',
    };
    server = createServer((req, res) => {
      if (req.url !== '/cdn-cgi/access/certs') {
        res.writeHead(404).end();
        return;
      }
      res
        .writeHead(200, { 'content-type': 'application/json' })
        .end(JSON.stringify({ keys: [jwk] }));
    });
    await new Promise<void>((resolve) =>
      server!.listen(0, '127.0.0.1', resolve)
    );
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('The test issuer needs a local TCP listener.');
    const issuer = `http://127.0.0.1:${address.port}`;
    const token = await new SignJWT({ email: 'studio-test@example.invalid' })
      .setProtectedHeader({ alg: 'RS256', kid: jwk.kid })
      .setIssuer(issuer)
      .setAudience('studio-e2e')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);
    const dbURL = new URL('postgresql:///postgres');
    dbURL.searchParams.set('host', '/tmp');
    dbURL.searchParams.set('user', userInfo().username);
    dbURL.searchParams.set('options', `-c search_path=${schema}`);
    const env = {
      ...process.env,
      SITE_MODE: 'preview',
      STUDIO_DATABASE_URL: dbURL.href,
      ...(process.env.MUSIC_E2E === '1'
        ? { MUSIC_PUBLIC_DATABASE_URL: dbURL.href }
        : {}),
      STUDIO_ORIGIN: origin,
      OWNER_ACCESS_ISSUER: issuer,
      OWNER_ACCESS_AUDIENCE: 'studio-e2e',
      OWNER_ACCESS_EMAIL: 'studio-test@example.invalid',
      STUDIO_TEST_ORIGIN: origin,
      STUDIO_TEST_TOKEN: token,
      STUDIO_E2E: '1',
    };
    // A real JWT/JWKS check protects the local server. No auth bypass or provider credentials.
    next = spawn('pnpm', ['exec', 'next', 'dev', '--port', String(port)], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    let logs = '';
    for (const stream of [next.stdout, next.stderr])
      stream?.on('data', (chunk) => {
        logs = (logs + chunk).slice(-16000);
        if (process.env.STUDIO_TEST_VERBOSE) process.stdout.write(chunk);
      });
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (next.exitCode !== null)
        throw new Error(`Preview server exited: ${logs}`);
      try {
        const response = await fetch(`${origin}/api/studio/documents`, {
          headers: { 'cf-access-jwt-assertion': token },
          signal: AbortSignal.timeout(3000),
        });
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        /* Process or server may have already stopped. */
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error(`Preview server did not become ready: ${logs}`);
    runningTests = spawn(
      'pnpm',
      [
        'exec',
        'playwright',
        'test',
        '--config',
        process.env.MUSIC_E2E
          ? 'tests/music-admin.config.mts'
          : 'tests/studio.config.mts',
        ...process.argv.slice(2),
      ],
      { env, stdio: 'inherit', detached: true }
    );
    const code = await new Promise<number | null>((resolve) =>
      runningTests!.once('exit', resolve)
    );
    process.exitCode = code || 0;
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

if (isMain(import.meta.url)) await runStudioTests();
