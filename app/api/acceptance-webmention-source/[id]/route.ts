import { createPool } from '@vercel/postgres';
import { createHash } from 'node:crypto';

import { resolvedDocumentLinks } from '@/lib/indieweb/document-links';
import { fetchPublicDocument } from '@/lib/indieweb/public-fetch';

const origin = 'https://indieweb-acceptance.vercel.app';
const databaseHost =
  'ep-winter-wind-b5iiaxe7-pooler.c-7.us-east-2.aws.neon.tech';
let pool: ReturnType<typeof createPool> | undefined;
type Context = { params: Promise<{ id: string }> };
function escape(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!
  );
}
function response(
  body: string | null,
  status: number,
  headers: Record<string, string> = {}
) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}
async function source(request: Request, context: Context) {
  const { id } = await context.params;
  const connectionString = process.env.POSTGRES_URL;
  if (
    !/^[a-f\d]{48}$/.test(id) ||
    process.env.NEXT_PUBLIC_SITE_ORIGIN !== origin ||
    process.env.VERCEL_PROJECT_ID !== 'prj_rurUFlQ4YKYKoMxGCaAyL6ASijHm' ||
    !connectionString ||
    new URL(connectionString).hostname !== databaseHost
  )
    return response(null, 404);
  const database = (pool ??= createPool({ connectionString, max: 1 }));
  if (
    !(
      await database.query(
        "SELECT to_regclass('public.acceptance_webmention_sources') AS source"
      )
    ).rows[0]?.source
  )
    return response(null, 404);
  const row = (
    await database.query(
      'SELECT * FROM acceptance_webmention_sources WHERE id=$1 AND expires_at>NOW()',
      [id]
    )
  ).rows[0];
  if (!row) return response(null, 404);
  const sourceUrl = new URL(request.url);
  sourceUrl.search = '';
  if (request.method === 'POST') {
    if (!row.receive_source_url) return response(null, 404);
    const form = await request.formData();
    const from = form.get('source');
    const target = form.get('target');
    if (
      from !== row.receive_source_url ||
      target !== sourceUrl.href ||
      new URL(String(from)).origin !== origin
    )
      return response(null, 400);
    const document = await fetchPublicDocument(String(from), {
      timeoutMs: 10000,
    });
    if (!document || document.status !== 200) return response(null, 400);
    const links = resolvedDocumentLinks(document.body, document.url).links;
    if (
      !links.includes(String(target)) ||
      (row.require_reply_url && !links.includes(row.require_reply_url))
    )
      return response(null, 400);
    await database.query(
      'UPDATE acceptance_webmention_sources SET received=$2 WHERE id=$1',
      [
        id,
        JSON.stringify({
          source: from,
          target,
          at: new Date().toISOString(),
          pageUrl: document.url,
          pageSha256: createHash('sha256').update(document.body).digest('hex'),
          upstreamLinkFound: true,
          nestedReplyFound: Boolean(row.require_reply_url),
        }),
      ]
    );
    return response(null, 202);
  }
  if (row.status !== 200) return response(null, row.status);
  const target = row.target_url
    ? `<a class="u-in-reply-to" href="${escape(row.target_url)}">Original writing</a>`
    : '';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escape(row.title)}</title></head><body><article class="h-entry"><h1 class="p-name">${escape(row.title)}</h1><a class="u-url" href="${escape(sourceUrl.href)}">Permalink</a><a class="p-author h-card" href="${escape(sourceUrl.href)}#author"><span class="p-name">Controlled acceptance reader</span></a><time class="dt-published" datetime="2026-10-07T12:00:00Z">October 7, 2026</time>${target}<div class="e-content" dir="auto">${row.body_html}</div></article></body></html>`;
  return response(
    html,
    200,
    row.receive_source_url
      ? { Link: `<${sourceUrl.href}>; rel="webmention"` }
      : {}
  );
}
export const GET = source;
export const POST = source;
