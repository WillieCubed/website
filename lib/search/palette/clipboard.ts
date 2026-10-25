import { absoluteUrl } from '@/lib/site/urls';

import type { Readout } from './types';

const MCP_PATH = '/api/mcp';

/** Copies text, resolving false when the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** A client config for the MCP server, as most desktop clients read it. */
function mcpConfig(): string {
  return JSON.stringify(
    {
      mcpServers: {
        'willie-page': { type: 'http', url: absoluteUrl(MCP_PATH) },
      },
    },
    null,
    2
  );
}

/** Shows the MCP endpoint and copies a client config for it. */
export async function mcp(): Promise<Readout> {
  const config = mcpConfig();
  const copied = await copyText(config);
  return {
    heading: copied
      ? 'Copied a client config'
      : 'Could not copy; the config is below',
    fields: [
      ['endpoint', absoluteUrl(MCP_PATH)],
      ['transport', 'Streamable HTTP, read-only'],
    ],
    body: config,
  };
}
