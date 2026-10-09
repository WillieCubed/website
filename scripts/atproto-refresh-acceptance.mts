import type {} from '@atcute/atproto';
import { Client, ok } from '@atcute/client';
import type { Did } from '@atcute/lexicons';
import type { StoredSession } from '@atcute/oauth-node-client';
import { sql } from '@vercel/postgres';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseArgs, parseEnv } from 'node:util';

const { values } = parseArgs({
  options: {
    env: { type: 'string', default: '.env.standard-test.local' },
    visitor: { type: 'string' },
  },
});
Object.assign(process.env, parseEnv(await readFile(values.env!, 'utf8')));
try {
  assert(
    process.env.NEXT_PUBLIC_ATPROTO_DID &&
      process.env.NEXT_PUBLIC_ATPROTO_DID !== 'did:plc:iyn6nc3ffqm2e3555exyrgvv'
  );
  assert(
    values.visitor &&
      values.visitor !== 'did:plc:iyn6nc3ffqm2e3555exyrgvv' &&
      /^did:(plc|web):/.test(values.visitor)
  );
  assert.equal(
    process.env.NEXT_PUBLIC_SITE_ORIGIN,
    'https://indieweb-acceptance.vercel.app'
  );
  assert(
    process.env.POSTGRES_URL &&
      /^ep-winter-wind-b5iiaxe7(?:-pooler)?\.c-7\.us-east-2\.aws\.neon\.tech$/.test(
        new URL(process.env.POSTGRES_URL).hostname
      )
  );
  assert(
    process.env.ATPROTO_OAUTH_STORAGE_KEY && process.env.ATPROTO_OAUTH_JWK
  );
  const hash = (value: string) =>
    createHash('sha256').update(value).digest('hex');
  const { decryptOAuthValue } = await import('../lib/atproto/oauth-crypto');
  const { oauthClient } = await import('../lib/atproto/oauth');
  async function tokens() {
    const stored =
      await sql`SELECT encrypted_value FROM atproto_oauth_sessions WHERE key_hash = ${hash(values.visitor!)} AND expires_at > NOW()`;
    assert.equal(
      stored.rows.length,
      1,
      'A completed real authorization is required.'
    );
    const tokens = decryptOAuthValue<StoredSession>(
      stored.rows[0].encrypted_value as string,
      process.env.ATPROTO_OAUTH_STORAGE_KEY!
    ).tokenSet;
    assert.equal(tokens.sub, values.visitor);
    assert(tokens.refresh_token && tokens.expires_at);
    return tokens;
  }
  const before = await tokens();
  const session = await oauthClient().restore(values.visitor as Did, {
    refresh: true,
  });
  const rpc = new Client({ handler: session });
  const pds = await ok(
    rpc.get('com.atproto.repo.listRecords', {
      params: {
        repo: values.visitor as Did,
        collection: 'site.standard.graph.subscription',
        limit: 1,
      },
    })
  );
  assert(Array.isArray(pds.records));
  const after = await tokens();
  assert.notEqual(hash(after.access_token), hash(before.access_token));
  assert(after.expires_at! >= before.expires_at!);
  assert.equal(after.iss, before.iss);
  assert.equal(after.aud, before.aud);
  console.log(
    JSON.stringify({
      status: 'passed',
      pid: process.pid,
      visitor: values.visitor,
      providerRefresh: true,
      authenticatedPdsRead: true,
      accessGenerationChanged: true,
      refreshTokenRotated: after.refresh_token !== before.refresh_token,
      beforeExpiresAt: new Date(before.expires_at!).toISOString(),
      afterExpiresAt: new Date(after.expires_at!).toISOString(),
    })
  );
} catch {
  console.error(
    'Real provider refresh or authenticated PDS read failed. No credential values were logged.'
  );
  process.exitCode = 1;
} finally {
  await sql.end();
}
