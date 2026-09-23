import { buildHostMetaResponse } from '@/lib/indieweb/discovery';
import { jsonResponse } from '@/lib/indieweb/responses';

/** The JSON form of host-meta (RFC 6415), beside the XRD at /host-meta. */
export async function GET() {
  return jsonResponse(buildHostMetaResponse(), {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
