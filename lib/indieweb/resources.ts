import { PUBLICATION_URI } from '@/lib/atproto/config';
import {
  AT_PROTOCOL_DID,
  INDIEAUTH_METADATA_ENDPOINT,
  MICROPUB_ENDPOINT,
  OEMBED_ENDPOINT,
  PUBLIC_WEBMENTIONS_ENDPOINT,
  SITE_AUTHOR_HANDLE,
  SITE_URL,
  WEBMENTION_ENDPOINT,
} from '@/lib/indieweb/constants';
import { MCP_ENDPOINT } from '@/lib/mcp/constants';

export interface AtProtocolResources {
  did?: string;
  publicationUri?: string;
}

export interface PublicResource {
  label: string;
  path: string;
  format: string;
  description: string;
  /** Groups reader-facing downloads without exposing discovery endpoints. */
  directory?: string;
  documentation?: string;
  /** A resource with required parameters or a protocol handshake is an address, not a browser link. */
  usage?: string;
}

export interface ResourceGroup {
  label: string;
  directoryLabel?: string;
  resources: PublicResource[];
}

export function getPublicResources(
  atproto: AtProtocolResources = {
    did: AT_PROTOCOL_DID,
    publicationUri: PUBLICATION_URI,
  }
): ResourceGroup[] {
  return [
    {
      label: 'Indexes',
      directoryLabel: 'Other formats',
      resources: [
        {
          label: 'XML sitemap',
          directory: 'XML sitemap',
          path: '/sitemap.xml',
          format: 'XML',
          description: 'Published pages in a format for search engines.',
        },
        {
          label: 'Agent guide',
          directory: 'llms.txt',
          path: '/llms.txt',
          format: 'Markdown',
          description: 'A text guide to the site for reading tools.',
        },
        {
          label: 'Crawler rules',
          path: '/robots.txt',
          format: 'Text',
          description: 'Indexing and crawler permissions.',
        },
      ],
    },
    {
      label: 'Feeds',
      directoryLabel: 'Feeds',
      resources: [
        {
          label: 'Site feed (RSS)',
          directory: 'Site updates',
          path: '/feed.xml',
          format: 'RSS',
          description: 'Recent published site content.',
        },
        {
          label: 'Site feed (Atom)',
          directory: 'Site updates',
          path: '/feed/atom',
          format: 'Atom',
          description: 'Recent published site content.',
        },
        {
          label: 'Site feed (JSON Feed)',
          directory: 'Site updates',
          path: '/feed/json',
          format: 'JSON Feed',
          description: 'Recent published site content.',
        },
        {
          label: 'Writings feed (RSS)',
          directory: 'Writings',
          path: '/writings/feed.xml',
          format: 'RSS',
          description: 'Published articles and notes.',
        },
        {
          label: 'Writings feed (Atom)',
          directory: 'Writings',
          path: '/writings/feed/atom',
          format: 'Atom',
          description: 'Published articles and notes.',
        },
        {
          label: 'Writings feed (JSON Feed)',
          directory: 'Writings',
          path: '/writings/feed/json',
          format: 'JSON Feed',
          description: 'Published articles and notes.',
        },
        {
          label: 'Webmention activity feed',
          directory: 'Responses',
          path: '/activity/feed.xml',
          format: 'RSS',
          description: 'Approved responses to site content.',
        },
      ],
    },
    {
      label: 'Protocols',
      directoryLabel: 'Tools',
      resources: [
        {
          label: 'MCP server',
          directory: 'MCP server',
          documentation:
            'https://modelcontextprotocol.io/docs/getting-started/intro',
          path: MCP_ENDPOINT,
          format: 'JSON-RPC',
          description: 'Read and search published content.',
          usage: 'Connect with an MCP client over Streamable HTTP.',
        },
        {
          label: 'Webmention endpoint',
          directory: 'Webmentions',
          documentation: 'https://www.w3.org/TR/webmention/',
          path: WEBMENTION_ENDPOINT,
          format: 'HTTP',
          description: 'Send a response from your own website.',
          usage: 'POST with source and target URLs.',
        },
        {
          label: 'Public webmentions',
          path: `${PUBLIC_WEBMENTIONS_ENDPOINT}?target=`,
          format: 'JSON',
          description: 'Approved webmentions for one page, as JSON.',
          usage: 'GET with target set to the full page URL.',
        },
        {
          label: 'Micropub endpoint',
          path: MICROPUB_ENDPOINT,
          format: 'HTTP',
          description: 'Publish or update content as the site owner.',
          usage: 'POST with an IndieAuth bearer token and a Micropub request.',
        },
        {
          label: 'IndieAuth server metadata',
          path: INDIEAUTH_METADATA_ENDPOINT,
          format: 'JSON',
          description: 'Sign in as this site with IndieAuth.',
        },
        {
          label: 'oEmbed provider',
          directory: 'Embeds',
          documentation: 'https://oembed.com/',
          path: `${OEMBED_ENDPOINT}?url=`,
          format: 'JSON',
          description: 'Get an embeddable preview of a published page.',
          usage: 'GET with url set to the full page URL.',
        },
        {
          label: 'WebFinger',
          path: '/.well-known/webfinger',
          format: 'JRD',
          description: 'Profile and protocol discovery.',
          usage: `GET with resource=acct:${SITE_AUTHOR_HANDLE}@${new URL(SITE_URL).hostname}.`,
        },
        {
          label: 'Host metadata (XML)',
          path: '/.well-known/host-meta',
          format: 'XML',
          description: 'WebFinger discovery template.',
        },
        {
          label: 'Host metadata (JSON)',
          path: '/.well-known/host-meta.json',
          format: 'JSON',
          description: 'WebFinger discovery template.',
        },
        ...(atproto.did
          ? [
              {
                label: 'AT Protocol DID',
                path: '/.well-known/atproto-did',
                format: 'Text',
                description:
                  'The AT Protocol DID behind the site’s Bluesky account.',
              },
            ]
          : []),
        ...(atproto.publicationUri
          ? [
              {
                label: 'standard.site publication',
                path: '/.well-known/site.standard.publication',
                format: 'Text',
                description:
                  'The AT-URI of the publication record every writing belongs to.',
              },
            ]
          : []),
        {
          label: 'security.txt',
          path: '/.well-known/security.txt',
          format: 'Text',
          description: 'Security contact and disclosure information.',
        },
        {
          label: 'humans.txt',
          path: '/humans.txt',
          format: 'Text',
          description: 'Who made the site and with what.',
        },
        {
          label: 'OpenSearch description',
          directory: 'Browser search',
          path: '/opensearch.xml',
          format: 'XML',
          description: 'Add this site to a browser’s search engines.',
        },
      ],
    },
    {
      label: 'Brand',
      resources: [
        {
          label: 'Brand guidelines',
          path: '/brand/guidelines.md',
          format: 'Markdown',
          description:
            'Rules for using the WillieCubed logo: clear space, minimum sizes, choosing a version, and what to avoid.',
        },
        {
          label: 'Brand guidelines (JSON)',
          path: '/brand/guidelines.json',
          format: 'JSON',
          description:
            'The same rules with every logo file’s URL and measurements.',
        },
      ],
    },
  ];
}
