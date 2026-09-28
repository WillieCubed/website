import {
  handleMicropubGet,
  handleMicropubPost,
} from '@/lib/indieweb/micropub-endpoint';

/**
 * Micropub queries: `q=config`, `q=syndicate-to`, `q=category`, and, with a
 * token, `q=source`. IndieWeb clients find this route through
 * `<link rel="micropub" href="/micropub" />` in the document head.
 */
export async function GET(request: Request) {
  return handleMicropubGet(request);
}

/**
 * Create a writing with an IndieAuth token carrying the `create` scope. See
 * docs/indieweb/README.md#micropub.
 */
export async function POST(request: Request) {
  return handleMicropubPost(request);
}
