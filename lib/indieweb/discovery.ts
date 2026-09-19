import {
  AT_PROTOCOL_DID,
  MICROPUB_ENDPOINT,
  OEMBED_ENDPOINT,
  PUBLIC_WEBMENTIONS_ENDPOINT,
  SITE_AUTHOR_HANDLE,
  SITE_NAME,
  SITE_URL,
  WEBMENTION_ENDPOINT,
} from '@/lib/indieweb/constants';
import type { HostMetaResponse, WebFingerResponse } from '@/lib/indieweb/types';
import { absoluteSiteUrl } from '@/lib/indieweb/utils';
import { MCP_ENDPOINT } from '@/lib/mcp/constants';

export function buildWebFingerResponse(
  resource: string | null
): WebFingerResponse {
  const subject =
    resource || `acct:${SITE_AUTHOR_HANDLE}@${new URL(SITE_URL).hostname}`;

  return {
    subject,
    aliases: [SITE_URL],
    links: [
      {
        rel: 'http://webfinger.net/rel/profile-page',
        type: 'text/html',
        href: SITE_URL,
      },
      {
        rel: 'self',
        type: 'text/html',
        href: SITE_URL,
      },
      {
        rel: 'http://webmention.org/',
        href: absoluteSiteUrl(WEBMENTION_ENDPOINT, SITE_URL),
      },
      {
        rel: 'micropub',
        href: absoluteSiteUrl(MICROPUB_ENDPOINT, SITE_URL),
      },
      {
        rel: 'http://purl.org/indieauth',
        href: SITE_URL,
      },
    ],
  };
}

export function buildHostMetaResponse(): HostMetaResponse {
  return {
    links: [
      {
        rel: 'lrdd',
        template: `${SITE_URL}/.well-known/webfinger?resource={uri}`,
      },
    ],
  };
}

export function buildHostMetaXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">
  <Link rel="lrdd" template="${SITE_URL}/.well-known/webfinger?resource={uri}" />
</XRD>
`;
}

export function buildAtProtocolDid(): string {
  return `${AT_PROTOCOL_DID}\n`;
}

export interface LlmsWriting {
  slug: string;
  title: string;
  description: string;
}

// A `]` or `[` in a title would end the link text early.
function linkText(text: string): string {
  return text.replace(/\[/g, '(').replace(/\]/g, ')');
}

function llmsLink(label: string, path: string, notes?: string): string {
  return `- [${linkText(label)}](${SITE_URL}${path})${notes ? `: ${notes}` : ''}`;
}

/**
 * The site's llms.txt, in the llmstxt.org shape: an H1, a blockquote
 * summary, then H2 sections of `- [name](url): notes` lists. Pass only
 * writings a visitor can open; drafts must never reach this file.
 */
export function buildLlmsSummary(writings: LlmsWriting[] = []): string {
  const sections = [
    `# ${SITE_NAME}\n\n> ${SITE_URL} is the personal website, writing archive, and IndieWeb home of ${SITE_NAME}.`,
  ];

  if (writings.length > 0) {
    sections.push(
      [
        '## Writings',
        '',
        // A note's description is its title, so it adds nothing to the line.
        ...writings.map((writing) =>
          llmsLink(
            writing.title,
            `/writings/${writing.slug}`,
            writing.description === writing.title
              ? undefined
              : writing.description
          )
        ),
      ].join('\n')
    );
  }

  sections.push(
    [
      '## Read',
      '',
      llmsLink(
        'Writings index',
        '/writings',
        'articles and notes; the index is an h-feed and every writing carries h-entry markup'
      ),
      llmsLink('Search', '/search?q=', 'search across every writing'),
      llmsLink('Initiatives', '/initiatives'),
      llmsLink('Site feed (RSS)', '/feed.xml'),
      llmsLink('Site feed (Atom)', '/feed/atom'),
      llmsLink('Site feed (JSON Feed)', '/feed/json'),
      llmsLink('Writings feed (RSS)', '/writings/feed.xml'),
      llmsLink('Writings feed (Atom)', '/writings/feed/atom'),
      llmsLink('Writings feed (JSON Feed)', '/writings/feed/json'),
    ].join('\n'),
    [
      '## Protocols',
      '',
      llmsLink(
        'MCP server',
        MCP_ENDPOINT,
        'read-only tools to search and read writings and list initiatives, over Streamable HTTP'
      ),
      llmsLink('Webmention endpoint', WEBMENTION_ENDPOINT),
      llmsLink(
        'Public webmentions',
        `${PUBLIC_WEBMENTIONS_ENDPOINT}?target=`,
        'approved webmentions for one page, as JSON'
      ),
      llmsLink('Webmention activity feed', '/activity/feed.xml'),
      llmsLink('Micropub endpoint', MICROPUB_ENDPOINT),
      llmsLink('oEmbed provider', `${OEMBED_ENDPOINT}?url=`),
      llmsLink('WebFinger', '/.well-known/webfinger'),
      llmsLink('security.txt', '/.well-known/security.txt'),
      llmsLink('OpenSearch description', '/opensearch.xml'),
    ].join('\n')
  );

  return `${sections.join('\n\n')}\n`;
}
