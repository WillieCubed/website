import { createPool } from '@vercel/postgres';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const origin = 'https://indieweb-acceptance.vercel.app';
const databaseHost =
  'ep-winter-wind-b5iiaxe7-pooler.c-7.us-east-2.aws.neon.tech';
let pool: ReturnType<typeof createPool> | undefined;
type Context = { params: Promise<{ id: string }> };
const sha256 = (body: string | Buffer) =>
  createHash('sha256').update(body).digest('hex');
function reply(body: string | null, status: number) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  });
}
async function callback(request: Request, context: Context) {
  const { id } = await context.params;
  const connectionString = process.env.POSTGRES_URL;
  if (
    !/^[a-f\d]{48}$/.test(id) ||
    process.env.NEXT_PUBLIC_SITE_ORIGIN !== origin ||
    process.env.VERCEL_PROJECT_ID !== 'prj_rurUFlQ4YKYKoMxGCaAyL6ASijHm' ||
    !connectionString ||
    new URL(connectionString).hostname !== databaseHost
  )
    return reply(null, 404);
  const database = (pool ??= createPool({ connectionString, max: 1 }));
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const row = (
      await client.query(
        'SELECT * FROM acceptance_websub_receipts WHERE id=$1 AND expires_at>NOW() FOR UPDATE',
        [id]
      )
    ).rows[0];
    if (!row || new URL(row.topic).origin !== origin) {
      await client.query('ROLLBACK');
      return reply(null, 404);
    }
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const mode = url.searchParams.get('hub.mode');
      const challenge = url.searchParams.get('hub.challenge');
      const lease = url.searchParams.get('hub.lease_seconds');
      if (
        (mode !== 'subscribe' && mode !== 'unsubscribe') ||
        mode !== row.pending_mode ||
        url.searchParams.get('hub.topic') !== row.topic ||
        !challenge ||
        !/^[+\-\d./=A-Z_a-z]+$/.test(challenge) ||
        (mode === 'subscribe' &&
          (!lease ||
            !/^\d+$/.test(lease) ||
            !Number.isSafeInteger(Number(lease)) ||
            Number(lease) <= 0))
      ) {
        await client.query('ROLLBACK');
        return reply(null, 404);
      }
      const verification = JSON.stringify({
        at: new Date().toISOString(),
        challengeSha256: sha256(challenge),
        ...(mode === 'subscribe' ? { leaseSeconds: Number(lease) } : {}),
      });
      if (mode === 'subscribe')
        await client.query(
          'UPDATE acceptance_websub_receipts SET pending_mode=NULL,active=true,subscription_verification=$2::jsonb WHERE id=$1',
          [id, verification]
        );
      else
        await client.query(
          'UPDATE acceptance_websub_receipts SET pending_mode=NULL,active=false,unsubscribe_verification=$2::jsonb WHERE id=$1',
          [id, verification]
        );
      await client.query('COMMIT');
      return reply(challenge, 200);
    }
    if (!row.active) {
      await client.query('ROLLBACK');
      return reply(null, 404);
    }
    const reader = request.body?.getReader();
    if (!reader) {
      await client.query('ROLLBACK');
      return reply(null, 400);
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 8 * 1024 * 1024) {
        await reader.cancel();
        await client.query('ROLLBACK');
        return reply(null, 413);
      }
      chunks.push(Buffer.from(next.value));
    }
    const body = Buffer.concat(chunks);
    let algorithm: string | undefined;
    for (const signature of (
      request.headers.get('x-hub-signature') ?? ''
    ).split(',')) {
      const match = /^(sha1|sha256|sha384|sha512)=([a-f\d]+)$/i.exec(
        signature.trim()
      );
      if (!match) continue;
      const actual = Buffer.from(match[2], 'hex');
      const expected = createHmac(match[1].toLowerCase(), row.secret)
        .update(body)
        .digest();
      if (
        actual.length === expected.length &&
        timingSafeEqual(actual, expected)
      ) {
        algorithm = match[1].toLowerCase();
        break;
      }
    }
    if (!algorithm) {
      await client.query('ROLLBACK');
      return reply(null, 403);
    }
    const contentType = (request.headers.get('content-type') ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (contentType !== row.content_type) {
      await client.query('ROLLBACK');
      return reply(null, 400);
    }
    const hash = sha256(body);
    if (
      hash !== row.baseline_hash &&
      body.toString('utf8').includes(row.marker)
    ) {
      const receipt = JSON.stringify({
        at: new Date().toISOString(),
        bytes: body.length,
        sha256: hash,
        signatureAlgorithm: algorithm,
        contentType,
        body: body.toString('utf8'),
      });
      await client.query(
        'UPDATE acceptance_websub_receipts SET delivery=$2::jsonb WHERE id=$1',
        [id, receipt]
      );
    }
    await client.query('COMMIT');
    return reply(null, 204);
  } catch (error) {
    await client.query('ROLLBACK');
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '42P01'
    )
      return reply(null, 404);
    throw error;
  } finally {
    client.release();
  }
}
export const GET = callback;
export const POST = callback;
