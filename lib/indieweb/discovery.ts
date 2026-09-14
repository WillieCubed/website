import {
  AT_PROTOCOL_DID,
  MICROPUB_ENDPOINT,
  SITE_AUTHOR_HANDLE,
  SITE_NAME,
  SITE_URL,
  WEBMENTION_ENDPOINT,
} from '@/lib/indieweb/constants';
import type { HostMetaResponse, WebFingerResponse } from '@/lib/indieweb/types';
import { absoluteSiteUrl } from '@/lib/indieweb/utils';

export function buildWebFingerResponse(
  resource: string | null
): WebFingerResponse {
  const subject = resource || `acct:${SITE_AUTHOR_HANDLE}@williecubed.me`;

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

export function buildLlmsSummary(): string {
  return `# ${SITE_NAME}

${SITE_URL} is the personal website, writing archive, and IndieWeb home of Willie Chalmers III.

Key surfaces:
- Writings: ${SITE_URL}/writings
- Feeds: ${SITE_URL}/feed.xml, ${SITE_URL}/feed/atom, ${SITE_URL}/feed/json
- IndieWeb activity: ${SITE_URL}/activity/feed.xml
- Webmention endpoint: ${SITE_URL}${WEBMENTION_ENDPOINT}
- Micropub endpoint: ${SITE_URL}${MICROPUB_ENDPOINT}
`;
}
