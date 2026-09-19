import { siteContent } from '@/lib/mcp/site-content';
import { createSiteMcpHandler } from '@/lib/mcp/site-server';

// The handler is stateless and answers both verbs the transport uses.
const handler = createSiteMcpHandler(siteContent);

export { handler as GET, handler as POST };
