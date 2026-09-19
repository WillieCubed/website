import { plainPage } from '@/lib/plain-page';

export type WhoamiLine = [label: string, value: string];

/** The Cloudflare-only `request.cf` object, when the host provides one. */
type CloudflareProperties = Record<string, unknown>;

function text(value: unknown): string | undefined {
  if (typeof value === 'string' && value !== '') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

// Vercel percent-encodes the city, so "Las Vegas" arrives as "Las%20Vegas".
function decode(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * What the host says about the request, in the order it reads best. Vercel
 * says it through `x-vercel-*` headers and Cloudflare through `request.cf`;
 * a line the host does not provide is left out rather than guessed.
 */
export function whoamiLines(
  headers: Headers,
  cf: CloudflareProperties = {}
): WhoamiLine[] {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const tls = [text(cf.tlsVersion), text(cf.tlsCipher)]
    .filter(Boolean)
    .join(' ');
  const asn = text(cf.asn);
  const rtt = text(cf.clientTcpRtt);

  const candidates: Array<[string, string | undefined]> = [
    ['ip', headers.get('cf-connecting-ip') ?? forwarded ?? undefined],
    ['agent', headers.get('user-agent') ?? undefined],
    ['country', headers.get('x-vercel-ip-country') ?? text(cf.country)],
    ['region', headers.get('x-vercel-ip-country-region') ?? text(cf.region)],
    ['city', decode(headers.get('x-vercel-ip-city')) ?? text(cf.city)],
    ['edge', text(cf.colo) ?? headers.get('x-vercel-id') ?? undefined],
    ['ray', headers.get('cf-ray') ?? undefined],
    ['http', text(cf.httpProtocol)],
    ['tls', tls || undefined],
    [
      'network',
      asn ? `AS${asn} ${text(cf.asOrganization) ?? ''}`.trim() : undefined,
    ],
    ['rtt', rtt ? `${rtt} ms` : undefined],
  ];

  return candidates.filter(
    (entry): entry is WhoamiLine => entry[1] !== undefined
  );
}

/** The request as the server sees it, for the person who made it. */
export function whoamiResponse(
  request: Request,
  cf?: CloudflareProperties
): Response {
  const lines = whoamiLines(request.headers, cf);
  const width = Math.max(0, ...lines.map(([label]) => label.length));

  return plainPage(request, {
    title: 'Who am I',
    lines: [
      'This is how the server sees your request. Nothing here is stored.',
      '',
      ...lines.map(([label, value]) => `${label.padEnd(width)}  ${value}`),
    ],
  });
}
