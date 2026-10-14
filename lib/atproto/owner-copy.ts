import { ComAtprotoRepoStrongRef } from '@atcute/atproto';
import { safeParse } from '@atcute/lexicons';

import { publishingIdentity } from './config';

export function assertOwnerCopy(
  ref: unknown
): asserts ref is { uri: string; cid: string } {
  const copy = ref as { uri?: unknown; cid?: unknown };
  if (
    typeof copy?.uri !== 'string' ||
    !copy.uri.startsWith(
      `at://${publishingIdentity().did}/app.bsky.feed.post/`
    ) ||
    !/^at:\/\/did:[^/]+\/app\.bsky\.feed\.post\/[^/]+$/.test(copy.uri) ||
    typeof copy.cid !== 'string' ||
    !safeParse(
      ComAtprotoRepoStrongRef.mainSchema,
      { uri: copy.uri, cid: copy.cid },
      { strict: true }
    ).ok
  ) {
    throw new Error(
      'A Bluesky copy must identify a post owned by the publication account.'
    );
  }
}
