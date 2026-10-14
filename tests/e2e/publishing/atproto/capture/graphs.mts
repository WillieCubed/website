import type {} from '@atcute/atproto';
import assert from 'node:assert/strict';

interface Context {
  settings: Record<string, string>;
  values: {
    workspace?: string | undefined;
    slug?: string | undefined;
    env: string;
    output: string;
    'refresh-wait-seconds': string;
    'cleanup-only': boolean;
    'defer-bluesky': boolean;
    'authorization-only': boolean;
    'cookie-delivery-failure': boolean;
    'social-only': boolean;
    'fixture-source-journal'?: string | undefined;
    'fixture-publication-journal'?: string | undefined;
    'social-runtime-revision'?: string | undefined;
  };
}

export async function graphFor(
  dependencies: Context,
  did: string,
  action: 'subscription' | 'recommendation' = 'subscription',
  targetOnly = true
) {
  const { resolvePds } = await import('../../../../../lib/atproto/identity');
  const url = new URL(
    '/xrpc/com.atproto.repo.listRecords',
    await resolvePds(did as import('@atcute/lexicons').Did)
  );
  const collection =
    action === 'subscription'
      ? 'site.standard.graph.subscription'
      : 'site.standard.graph.recommend';
  const field = action === 'subscription' ? 'publication' : 'document';
  let target = `at://${dependencies.settings.NEXT_PUBLIC_ATPROTO_DID}/site.standard.publication/${dependencies.settings.ATPROTO_PUBLICATION_RKEY}`;
  if (action === 'recommendation' && targetOnly) {
    const { loadWriting } = await import('../../../../../lib/writings/load');
    const { documentRkey } = await import('../../../../../lib/atproto/keys');
    const { writing } = await loadWriting(dependencies.values.slug!);
    assert(!writing.draft);
    target = `at://${dependencies.settings.NEXT_PUBLIC_ATPROTO_DID}/site.standard.document/${documentRkey(`/writings/${dependencies.values.slug}`, writing.published)}`;
  }
  const records: {
    uri: string;
    cid: string;
    value: Record<string, unknown>;
  }[] = [];
  let cursor: string | undefined;
  const cursors = new Set<string>();
  do {
    url.search = new URLSearchParams({
      repo: did,
      collection,
      limit: '100',
      ...(cursor && { cursor }),
    }).toString();
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
    assert(response.ok);
    const page = (await response.json()) as {
      records: typeof records;
      cursor?: string;
    };
    records.push(
      ...page.records.filter(
        (record) => !targetOnly || record.value[field] === target
      )
    );
    cursor = page.cursor;
    if (cursor) {
      assert(
        !cursors.has(cursor),
        'Public PDS pagination repeated its cursor.'
      );
      cursors.add(cursor);
    }
  } while (cursor);
  return records;
}
