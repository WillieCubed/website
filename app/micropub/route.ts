import {
  handleMicropubGet,
  handleMicropubPost,
  micropubCorsPreflight,
} from '@/lib/indieweb/micropub/endpoint';

/**
 * Return publishing configuration, syndication targets, or published
 * categories selected by q. For q=source, require a valid site token and
 * return the writing's editable properties, including drafts. Return 400 for
 * an unsupported query.
 */
export async function GET(request: Request) {
  return handleMicropubGet(request);
}

/**
 * Create, update, or delete a writing with an IndieAuth token carrying the
 * `create`, `update`, or `delete` scope.
 */
export async function POST(request: Request) {
  return handleMicropubPost(request);
}

/** Return the CORS preflight headers for browser-based publishing requests. */
export function OPTIONS() {
  return micropubCorsPreflight();
}
