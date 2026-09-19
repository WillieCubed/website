import { corsPreflight, withCors } from '@/lib/mcp/cors';
import { siteContent } from '@/lib/mcp/site-content';
import { createSiteMcpHandler } from '@/lib/mcp/site-server';

// The handler is stateless and answers both verbs the transport uses. The
// OPTIONS export answers a browser client's CORS preflight.
const handler = withCors(createSiteMcpHandler(siteContent));

export { handler as GET, handler as POST, corsPreflight as OPTIONS };
