import { plainPage } from '@/lib/plain-page';

/**
 * The additions this pot keeps: the milk types RFC 2324 lists in section
 * 2.2.2.1. Anything else in `Accept-Additions` is a 406.
 */
export const TEA_ADDITIONS = [
  'Cream',
  'Half-and-half',
  'Whole-milk',
  'Part-Skim',
  'Skim',
  'Non-Dairy',
] as const;

/**
 * Hyper Text Coffee Pot Control Protocol (RFC 2324): this server is a
 * teapot, so a request to brew coffee is refused with 418.
 */
export function coffeeResponse(request: Request): Response {
  const { pathname } = new URL(request.url);
  return plainPage(request, {
    status: 418,
    title: "418 I'm a teapot",
    lines: [
      `${request.method} ${pathname}`,
      "418 I'm a teapot",
      '',
      'This server is a teapot, not a coffee pot, so it cannot brew coffee',
      '(RFC 2324, section 2.3.2). Tea is at /tea.',
    ],
  });
}

function isTeapotMessage(request: Request): boolean {
  const type = request.headers.get('Content-Type')?.split(';')[0];
  return type?.trim().toLowerCase() === 'message/teapot';
}

function requestedAdditions(request: Request): string[] {
  return (request.headers.get('Accept-Additions') ?? '')
    .split(',')
    .map((addition) => addition.split(';')[0].trim())
    .filter(Boolean);
}

function canonicalAddition(addition: string): string | undefined {
  return TEA_ADDITIONS.find(
    (known) => known.toLowerCase() === addition.toLowerCase()
  );
}

/**
 * The tea side of the protocol (RFC 7168). `POST` a `message/teapot` body of
 * `start` or `stop`, optionally with an `Accept-Additions` header.
 */
export async function teaResponse(request: Request): Promise<Response> {
  const on_hand = `Additions on hand: ${TEA_ADDITIONS.join(', ')}.`;

  if (request.method !== 'POST') {
    return plainPage(request, {
      title: 'The teapot',
      lines: [
        'This is a teapot. It speaks HTCPCP-TEA (RFC 7168).',
        '',
        'POST a message/teapot body of "start" or "stop" to /tea.',
        on_hand,
      ],
    });
  }

  if (!isTeapotMessage(request)) {
    return plainPage(request, {
      status: 415,
      title: '415 Unsupported Media Type',
      lines: ['Send a Content-Type of message/teapot.'],
    });
  }

  const message = (await request.text()).trim().toLowerCase();
  if (message !== 'start' && message !== 'stop') {
    return plainPage(request, {
      status: 400,
      title: '400 Bad Request',
      lines: ['The body of a message/teapot request is "start" or "stop".'],
    });
  }

  if (message === 'stop') {
    return plainPage(request, { title: 'Stopped', lines: ['Stopped.'] });
  }

  const additions = requestedAdditions(request);
  const missing = additions.filter((addition) => !canonicalAddition(addition));
  if (missing.length > 0) {
    return plainPage(request, {
      status: 406,
      title: '406 Not Acceptable',
      lines: [`This pot has no ${missing.join(', ')}.`, on_hand],
    });
  }

  const served = additions.map((addition) => canonicalAddition(addition));
  return plainPage(request, {
    title: 'Brewing',
    lines: [
      served.length > 0
        ? `Brewing tea with ${served.join(', ')}.`
        : 'Brewing tea.',
    ],
  });
}
