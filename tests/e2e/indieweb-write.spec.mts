import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { type Server, createServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';

import { site } from '../../lib/site';

const databaseURL = process.env.INDIEWEB_TEST_POSTGRES_URL;
const postPath = process.env.INDIEWEB_TEST_POST_PATH;
const moderationSecret = process.env.WEBMENTION_MODERATION_SECRET;
const writeEnabled = Boolean(
  databaseURL &&
  postPath &&
  moderationSecret &&
  !process.env.INDIEWEB_TEST_BASE_URL
);

test.skip(
  !writeEnabled,
  'Set an isolated local database, published test post, and moderation secret.'
);
test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);

test('Micropub creates a note only with a valid local IndieAuth grant', async ({
  request,
}) => {
  const db = new pg.Pool({ connectionString: databaseURL });
  const token = randomBytes(24).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const slug = `indieweb-http-${randomBytes(6).toString('hex')}`;
  const path = join(process.cwd(), 'content/writings', `${slug}.mdx`);
  const form = {
    h: 'entry',
    content: 'A local HTTP acceptance note.',
    'mp-slug': slug,
  };

  try {
    await db.query(
      `INSERT INTO indieauth_tokens (token_hash, client_id, me, scope, expires_at)
       VALUES ($1, $2, $3, 'create', NOW() + INTERVAL '1 hour')`,
      [tokenHash, 'https://indieweb-test.local/', site.origin]
    );
    expect((await request.post('/micropub', { form })).status()).toBe(401);
    expect(
      (
        await request.post('/micropub', {
          headers: { authorization: 'Bearer invalid-test-token' },
          form,
        })
      ).status()
    ).toBe(401);

    const created = await request.post('/micropub', {
      headers: { authorization: `Bearer ${token}` },
      form,
    });
    expect(created.status(), await created.text()).toBe(202);
    expect(created.headers().location).toBe(`${site.origin}/writings/${slug}`);
    const content = await readFile(path, 'utf8');
    expect(content).toContain('draft: false');
    expect(content).toContain('A local HTTP acceptance note.');
  } finally {
    await db.query('DELETE FROM indieauth_tokens WHERE token_hash = $1', [
      tokenHash,
    ]);
    await db.end();
    await rm(path, { force: true });
  }
});

test('a verified reply stays hidden until approval, then disappears when its link is removed', async ({
  request,
}) => {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0') {
    throw new Error(
      'Set NODE_TLS_REJECT_UNAUTHORIZED=0 only for this local HTTPS source test.'
    );
  }
  const db = new pg.Pool({ connectionString: databaseURL });
  const directory = await mkdtemp(join(tmpdir(), 'indieweb-source-'));
  const key = join(directory, 'key.pem');
  const cert = join(directory, 'cert.pem');
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-sha256',
      '-nodes',
      '-keyout',
      key,
      '-out',
      cert,
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
    ],
    { stdio: 'ignore' }
  );

  let linksToPost = true;
  const target = `${site.origin}${postPath}`;
  let source = '';
  const server: Server = createServer(
    { key: await readFile(key), cert: await readFile(cert) },
    (_incoming, outgoing) => {
      outgoing.setHeader('Content-Type', 'text/html');
      outgoing.end(
        `<article class="h-entry"><a class="u-url" href="${source}">Reply</a><a class="u-in-reply-to" href="${linksToPost ? target : 'https://example.org/'}">Target</a><p class="e-content">A verified local reply.</p><span class="p-author h-card"><span class="p-name">Local tester</span></span></article>`
      );
    }
  );
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing HTTPS source port.');
  source = `https://127.0.0.1:${address.port}/`;

  const mention = () =>
    request.post('/webmention', { form: { source, target } });
  const row = async () =>
    (
      await db.query(
        'SELECT id, type, is_verified, is_approved, is_deleted FROM webmentions WHERE source_url = $1',
        [source]
      )
    ).rows[0];

  try {
    expect((await mention()).status()).toBe(202);
    await expect.poll(async () => (await row())?.is_verified).toBe(true);
    expect((await row()).type).toBe('reply');
    expect(
      await (
        await request.get(`/webmentions?target=${encodeURIComponent(target)}`)
      ).json()
    ).toMatchObject({ count: 0 });

    const approved = await request.post('/api/webmention/moderate', {
      headers: { authorization: `Bearer ${moderationSecret}` },
      data: { action: 'approve', id: (await row()).id },
    });
    expect(approved.status()).toBe(200);
    await expect
      .poll(
        async () =>
          (
            await (
              await request.get(
                `/webmentions?target=${encodeURIComponent(target)}`
              )
            ).json()
          ).count
      )
      .toBe(1);
    await expect
      .poll(
        async () =>
          (await (await request.get(postPath!)).text()).includes(
            'A verified local reply'
          ),
        { timeout: 90_000, intervals: [1_000, 5_000] }
      )
      .toBe(true);

    linksToPost = false;
    expect((await mention()).status()).toBe(202);
    await expect.poll(async () => (await row())?.is_deleted).toBe(true);
    expect((await row()).is_approved).toBe(false);
    const removed = await request.get(
      `/webmentions?target=${encodeURIComponent(target)}`
    );
    expect(removed.headers()['cache-control']).toContain('no-store');
    expect((await removed.json()).count).toBe(0);
    await expect
      .poll(
        async () =>
          (await (await request.get(postPath!)).text()).includes(
            'A verified local reply'
          ),
        { timeout: 30_000, intervals: [1_000, 3_000] }
      )
      .toBe(false);
  } finally {
    await db.query('DELETE FROM webmentions WHERE source_url = $1', [source]);
    await db.end();
    server.close();
    await rm(directory, { recursive: true, force: true });
  }
});
