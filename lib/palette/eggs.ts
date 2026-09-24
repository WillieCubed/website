import { randomlyChooseTagline } from '@/lib/enhancements';
import { absoluteUrl } from '@/lib/site';

import type { Readout } from './types';

/**
 * The easter eggs' readouts. Each one makes the real request the protocol
 * route answers and shows what came back, so a readout is only ever what the
 * server said. A request that fails says what failed instead of standing in
 * a made-up response.
 */

/** The path the MCP server answers on, as docs/protocols.md lists it. */
export const MCP_PATH = '/api/mcp';

/**
 * The line a status would carry over HTTP/1.1. HTTP/2 sends no reason
 * phrase, so `statusText` is empty on most hosts and the readout would
 * otherwise show a bare number.
 */
const REASONS: Record<number, string> = {
  200: 'OK',
  400: 'Bad Request',
  404: 'Not Found',
  406: 'Not Acceptable',
  415: 'Unsupported Media Type',
  418: "I'm a teapot",
  500: 'Internal Server Error',
};

function statusLine(response: Response): string {
  const reason = response.statusText || REASONS[response.status] || '';
  return `HTTP ${response.status} ${reason}`.trim();
}

/** Every header the browser lets a same-origin page read, in order. */
function headerFields(response: Response): Array<[string, string]> {
  return [...response.headers.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function failure(request: string, error: unknown): Readout {
  const reason = error instanceof Error ? error.message : String(error);
  return {
    heading: `${request} failed`,
    body: reason || 'The request did not complete.',
    failed: true,
  };
}

/**
 * Sends one request and reads its body as text. `Accept: text/plain` keeps
 * the plain-page routes (lib/plain-page.ts) from answering with the HTML
 * document meant for a browser tab.
 */
async function exchange(
  method: string,
  path: string,
  init: RequestInit = {}
): Promise<{ response: Response; text: string }> {
  const response = await fetch(path, {
    ...init,
    method,
    cache: 'no-store',
    headers: { Accept: 'text/plain', ...init.headers },
  });
  return { response, text: (await response.text()).trimEnd() };
}

/** The whole exchange: status, headers, and body, as `curl -i` shows it. */
async function fullReadout(
  method: string,
  path: string,
  init?: RequestInit
): Promise<Readout> {
  const request = `${method} ${path}`;
  try {
    const { response, text } = await exchange(method, path, init);
    return {
      heading: statusLine(response),
      fields: [['request', request], ...headerFields(response)],
      body: text,
      // A 418 is the teapot doing its job, not a failure.
      failed: response.status >= 500,
    };
  } catch (error) {
    return failure(request, error);
  }
}

/** HTCPCP: asks the teapot for coffee, and gets the real 418. */
export function brewCoffee(): Promise<Readout> {
  return fullReadout('POST', '/coffee');
}

/** HTCPCP-TEA: starts a pot at /tea. */
export function brewTea(): Promise<Readout> {
  return fullReadout('POST', '/tea', {
    headers: { 'Content-Type': 'message/teapot' },
    body: 'start',
  });
}

/** What the server saw of this request, only the lines the host provides. */
export async function whoami(): Promise<Readout> {
  try {
    const { response, text } = await exchange('GET', '/whoami');
    return {
      heading: statusLine(response),
      body: text,
      failed: !response.ok,
    };
  } catch (error) {
    return failure('GET /whoami', error);
  }
}

/** Reads the clacks header off a live response. */
export async function clacks(): Promise<Readout> {
  // A small static file: every path carries the header, and this one costs
  // the server nothing to answer.
  const request = 'HEAD /robots.txt';
  try {
    const response = await fetch('/robots.txt', {
      method: 'HEAD',
      cache: 'no-store',
    });
    const value = response.headers.get('X-Clacks-Overhead');
    if (!value) {
      return {
        heading: statusLine(response),
        fields: [['request', request]],
        body: 'The response carried no X-Clacks-Overhead header.',
        failed: true,
      };
    }
    return {
      heading: `X-Clacks-Overhead: ${value}`,
      fields: [['request', request]],
      body: 'A man is not dead while his name is still spoken.',
    };
  } catch (error) {
    return failure(request, error);
  }
}

/** The security contact and when the policy lapses, from security.txt. */
export async function securityTxt(): Promise<Readout> {
  const path = '/.well-known/security.txt';
  try {
    const { response, text } = await exchange('GET', path);
    if (!response.ok) {
      return { heading: statusLine(response), body: text, failed: true };
    }
    const fields = text
      .split('\n')
      .map((line) => line.match(/^(Contact|Expires):\s*(.+)$/i))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map(([, label, value]): [string, string] => [
        label.toLowerCase(),
        value.trim(),
      ]);
    if (fields.length === 0) {
      return {
        heading: statusLine(response),
        fields: [['request', `GET ${path}`]],
        body: 'The file has no Contact or Expires line.',
        failed: true,
      };
    }
    return {
      heading: statusLine(response),
      fields: [['request', `GET ${path}`], ...fields],
    };
  } catch (error) {
    return failure(`GET ${path}`, error);
  }
}

/** A client config for the MCP server, as most desktop clients read it. */
export function mcpConfig(): string {
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

/** A tagline, never the same one twice running. */
export function fortune(previous?: string): Readout {
  let tagline = randomlyChooseTagline();
  for (let tries = 0; tagline === previous && tries < 5; tries += 1) {
    tagline = randomlyChooseTagline();
  }
  return { heading: tagline, body: 'Press Enter for another.' };
}

/**
 * Owner sign-in is the palette's next part (B2 in the palette spec). Until
 * it exists, `sudo` says so plainly rather than pretending to ask for a
 * password.
 */
export function sudo(): Readout {
  return {
    heading: 'sudo: owner sign-in is not wired up yet',
    body: 'There is nothing to elevate to. Owner commands will arrive with it.',
  };
}

/** Copies text, resolving false when the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
