import { corsPreflight, withCors } from '@/lib/mcp/cors';
import { siteContent } from '@/lib/mcp/site-content';
import { createSiteMcpHandler } from '@/lib/mcp/site-server';

const handler = withCors(createSiteMcpHandler(siteContent));

/**
 * Handle read-only MCP requests for site content over GET and POST. Return
 * CORS preflight headers for OPTIONS; retain no per-client server state.
 */
export { handler as GET, corsPreflight as OPTIONS, handler as POST };
