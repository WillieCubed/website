import {
  handleMicropubGet,
  handleMicropubPost,
  micropubCorsPreflight,
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
 * Create, update, or delete a writing with an IndieAuth token carrying the
 * `create`, `update`, or `delete` scope. See docs/indieweb/README.md#micropub.
 */
export async function POST(request: Request) {
  return handleMicropubPost(request);
}

export function OPTIONS() {
  return micropubCorsPreflight();
}
