import { type APIRequestContext, test } from '@playwright/test';

// A production build serves a draft as a 404, so a check that reads a
// particular writing, tag, or initiative only runs once it is published,
// the way the post checks wait for INDIEWEB_TEST_POST_PATH.

export async function isPublished(
  request: APIRequestContext,
  path: string
): Promise<boolean> {
  return (await request.get(path, { maxRedirects: 0 })).status() !== 404;
}

export async function skipUnlessPublished(
  request: APIRequestContext,
  path: string
): Promise<void> {
  test.skip(!(await isPublished(request, path)), `${path} is a draft`);
}
