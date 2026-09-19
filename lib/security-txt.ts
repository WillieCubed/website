import { absoluteUrl, site } from '@/lib/site';

/**
 * RFC 9116 makes Expires mandatory and recommends under a year. A unit test
 * fails 30 days before this date; renew it then.
 */
export const SECURITY_TXT_EXPIRES = '2027-09-01T00:00:00Z';

export function buildSecurityTxt(): string {
  return [
    `Contact: mailto:${site.author.email}`,
    `Expires: ${SECURITY_TXT_EXPIRES}`,
    'Preferred-Languages: en',
    `Canonical: ${absoluteUrl('/.well-known/security.txt')}`,
    '',
  ].join('\n');
}
