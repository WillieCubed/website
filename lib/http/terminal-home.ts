import { focuses } from '@/lib/home/focuses';
import { site } from '@/lib/site/identity';

import { homepageNegotiationHeaders } from './response-headers';

export const terminalHomeHeaders = {
  ...homepageNegotiationHeaders,
  // Shared caches can ignore Vary fields other than Accept-Encoding.
  'Cache-Control': 'private, no-store',
};

function rangeQuality(parameters: string[]) {
  const weight = parameters
    .map((part) => part.trim())
    .find((part) => part.startsWith('q='));
  if (weight === undefined) return 1;
  return /^q=(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(weight)
    ? Number(weight.slice(2))
    : 0;
}

function supportsParameters(parameters: string[]) {
  for (const part of parameters) {
    const parameter = part.trim();
    if (parameter.startsWith('q=')) break;
    if (!/^charset=(?:utf-8|"utf-8")$/.test(parameter)) return false;
  }
  return true;
}

function preference(accept: string, subtype: string) {
  let specificity = -1;
  let quality = 0;
  for (const range of accept.toLowerCase().split(',')) {
    const [media, ...parameters] = range.trim().split(';');
    if (!supportsParameters(parameters)) continue;
    const mediaRank = ['*/*', 'text/*', `text/${subtype}`].indexOf(
      media.trim()
    );
    if (mediaRank < 0) continue;
    const qualityIndex = parameters.findIndex((part) =>
      part.trim().startsWith('q=')
    );
    const parameterCount = qualityIndex < 0 ? parameters.length : qualityIndex;
    const rank = mediaRank * 10 + parameterCount;
    const value = rangeQuality(parameters);
    if (rank > specificity || (rank === specificity && value > quality)) {
      specificity = rank;
      quality = value;
    }
  }
  return { specificity, quality };
}

function wantsTerminal(headers: Headers) {
  const accept = headers.get('Accept') ?? '*/*';
  const plain = preference(accept, 'plain');
  const html = preference(accept, 'html');
  if (plain.quality === 0 || plain.quality < html.quality) return false;
  if (plain.quality > html.quality) return true;
  if (html.specificity >= 20) return false;
  return (
    plain.specificity > html.specificity ||
    /^curl\/\S+/i.test(headers.get('User-Agent') ?? '')
  );
}

function wrap(text: string, width = 68): string[] {
  const lines = [''];
  for (const word of text.split(/\s+/)) {
    const last = lines.length - 1;
    if (lines[last] && lines[last].length + word.length + 1 > width)
      lines.push(word);
    else lines[last] += `${lines[last] ? ' ' : ''}${word}`;
  }
  return lines;
}

function homepageText() {
  return [
    '',
    '  W I L L I E C U B E D',
    `  ${site.name}`,
    '',
    ...wrap(site.description).map((line) => `  ${line}`),
    '',
    '  RIGHT NOW',
    '',
    ...focuses.flatMap((focus) =>
      wrap(focus.line, 64).map(
        (line, index) => `  ${index === 0 ? '*' : ' '} ${line}`
      )
    ),
    '',
    '  MY WORK',
    '',
    ...site.ventures.flatMap((venture) => [
      `  ${venture.name}`,
      `  ${venture.url}`,
      '',
    ]),
    '  EXPLORE',
    '',
    `  Writings     ${site.origin}/writings`,
    `  Projects     ${site.origin}/projects`,
    `  Initiatives  ${site.origin}/initiatives`,
    '',
    '  SAY HELLO',
    '',
    `  ${site.author.email}`,
    ...site.social.map((profile) => `  ${profile.href}`),
    '',
    `  ${site.origin}`,
    '  For HTML, send Accept: text/html or X-Original: true.',
    '',
  ].join('\n');
}

/** Only the public, query-free homepage has a terminal representation. */
export function terminalHome(request: Request): Response | undefined {
  const url = new URL(request.url);
  if (
    url.pathname !== '/' ||
    url.search ||
    !['GET', 'HEAD'].includes(request.method) ||
    request.headers.get('X-Original')?.toLowerCase() === 'true' ||
    request.headers.has('RSC') ||
    request.headers.has('Next-Router-Prefetch') ||
    !wantsTerminal(request.headers)
  )
    return undefined;
  return new Response(request.method === 'HEAD' ? null : homepageText(), {
    headers: {
      ...terminalHomeHeaders,
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
