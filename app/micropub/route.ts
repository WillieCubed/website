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
 * Create, update, delete, or restore a writing using Micropub form data or
 * JSON. Require a valid site token with the scope needed by the action.
 * Persist through the configured GitHub repository or the local writable
 * checkout.
 */
export async function POST(request: Request) {
  return handleMicropubPost(request);
}

/** Return the CORS preflight headers for browser-based publishing requests. */
export function OPTIONS() {
  return micropubCorsPreflight();
}
