import { handleMediaPost } from '@/lib/indieweb/media-endpoint';
import { micropubCorsPreflight } from '@/lib/indieweb/micropub-endpoint';

export async function POST(request: Request) {
  return handleMediaPost(request);
}

export function OPTIONS() {
  return micropubCorsPreflight();
}
