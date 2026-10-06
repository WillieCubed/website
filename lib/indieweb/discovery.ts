import {
  AT_PROTOCOL_DID,
  MICROPUB_ENDPOINT,
  SITE_AUTHOR_HANDLE,
  SITE_NAME,
  SITE_URL,
  WEBMENTION_ENDPOINT,
} from '@/lib/indieweb/constants';
import { INDIEAUTH_DISCOVERY_LINKS } from '@/lib/indieweb/discovery-links';
import {
  type AtProtocolResources,
  getPublicResources,
} from '@/lib/indieweb/resources';
import type { HostMetaResponse, WebFingerResponse } from '@/lib/indieweb/types';
import { absoluteSiteUrl } from '@/lib/indieweb/utils';

/**
 * The resources WebFinger answers for: the author's acct: URI and the home
 * page. The home page also resolves without its trailing slash, the form
 * the response lists as an alias.
 */
const WEBFINGER_RESOURCES = new Set([
  `acct:${SITE_AUTHOR_HANDLE}@${new URL(SITE_URL).hostname}`,
  new URL(SITE_URL).href,
  SITE_URL,
]);

/**
 * The JRD for a resource this site describes, or null for any other
 * resource, which RFC 7033 answers with a 404.
 */
export function buildWebFingerResponse(
  resource: string
): WebFingerResponse | null {
  if (!WEBFINGER_RESOURCES.has(resource)) return null;

  return {
    subject: resource,
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
      // The same IndieAuth links the HTML head carries.
      ...INDIEAUTH_DISCOVERY_LINKS.map(({ rel, href }) => ({
        rel,
        href: absoluteSiteUrl(href, SITE_URL),
      })),
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

/** The body of /.well-known/atproto-did, or null when no DID is configured. */
export function buildAtProtocolDid(
  did: string | undefined = AT_PROTOCOL_DID
): string | null {
  return did ? `${did}\n` : null;
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

// encodeURIComponent leaves ( and ) alone, and either would end the link.
function pathSegment(segment: string): string {
  return encodeURIComponent(segment).replace(
    /[()]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function llmsLink(label: string, path: string, notes?: string): string {
  // The notes stay on the list line, so a description's line breaks collapse.
  const text = notes?.replace(/\s+/g, ' ').trim();
  return `- [${linkText(label)}](${SITE_URL}${path})${text ? `: ${text}` : ''}`;
}

/** The AT Protocol values that decide which of its endpoints llms.txt lists. */
export type LlmsAtProtocol = AtProtocolResources;

/**
 * The site's llms.txt, in the llmstxt.org shape: an H1, a blockquote
 * summary, then H2 sections of `- [name](url): notes` lists. Pass only
 * writings a visitor can open; drafts must never reach this file. The AT
 * Protocol entries appear only for what is configured, as their routes
 * answer 404 otherwise; `atproto` defaults to the site's configuration.
 */
export function buildLlmsSummary(
  writings: LlmsWriting[] = [],
  atproto?: LlmsAtProtocol
): string {
  const sections = [
    `# ${SITE_NAME}\n\n> ${SITE_URL} is the personal website, writing archive, and IndieWeb home of ${SITE_NAME}.`,
    // app/robots.ts holds the same line: agents reading for a person and AI
    // search are welcome, training crawlers are disallowed site-wide.
    `Assistants fetching pages for a reader and AI search engines are welcome to use this file, the pages it links, and the MCP server. AI training crawlers are not: [robots.txt](${SITE_URL}/robots.txt) disallows them across the whole site.`,
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
            `/writings/${pathSegment(writing.slug)}`,
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
        'Sitemap',
        '/sitemap',
        'browse published pages, feeds, and other formats'
      ),
      llmsLink(
        'Writings index',
        '/writings',
        'articles and notes; the index is an h-feed and every writing carries h-entry markup'
      ),
      llmsLink(
        'Search',
        '/search?q=',
        'search across writings, initiatives, and pages'
      ),
      llmsLink('Initiatives', '/initiatives'),
    ].join('\n')
  );
  for (const group of getPublicResources(atproto)) {
    sections.push(
      [
        `## ${group.label}`,
        '',
        ...group.resources.map(({ label, path, description, usage }) =>
          llmsLink(label, path, usage ? `${description} ${usage}` : description)
        ),
        ...(group.label === 'Brand'
          ? [llmsLink('Brand page', '/brand', 'logo files, colors, and type')]
          : []),
      ].join('\n')
    );
  }

  return `${sections.join('\n\n')}\n`;
}
