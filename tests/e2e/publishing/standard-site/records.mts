import type {} from '@atcute/atproto';
import assert from 'node:assert/strict';

import type { RepoRecord } from '../../../../lib/atproto/types';

interface Context {
  pds: string;
  did: string | undefined;
}

export async function publicRecord(
  dependencies: Context,
  collection: string,
  rkey: string
): Promise<RepoRecord> {
  const url = new URL('/xrpc/com.atproto.repo.getRecord', dependencies.pds);
  url.search = new URLSearchParams({
    repo: dependencies.did!,
    collection,
    rkey,
  }).toString();
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  });
  assert(response.ok, `Public PDS record request failed (${response.status}).`);
  return response.json() as Promise<RepoRecord>;
}
