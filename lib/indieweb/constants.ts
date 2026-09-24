import { site } from '@/lib/site';

export const SITE_URL = site.origin;
export const SITE_NAME = site.name;
export const SITE_AUTHOR_EMAIL = site.author.email;
export const SITE_AUTHOR_HANDLE = site.author.handle;
export const AT_PROTOCOL_DID = site.author.atprotoDid;
export const INDIEAUTH_METADATA_ENDPOINT =
  '/.well-known/oauth-authorization-server';
export const INDIEAUTH_AUTHORIZATION_ENDPOINT = '/indieauth/auth';
export const INDIEAUTH_CONSENT_ENDPOINT = '/indieauth/consent';
export const INDIEAUTH_TOKEN_ENDPOINT = '/indieauth/token';
export const INDIEAUTH_INTROSPECTION_ENDPOINT = '/indieauth/introspect';
export const INDIEAUTH_REVOCATION_ENDPOINT = '/indieauth/revoke';
export const WEBMENTION_ENDPOINT = '/webmention';
export const MICROPUB_ENDPOINT = '/micropub';
export const MICROPUB_MEDIA_ENDPOINT = '/micropub/media';
export const PUBLIC_WEBMENTIONS_ENDPOINT = '/webmentions';
export const OEMBED_ENDPOINT = '/oembed';
export const WEBSUB_HUB = 'https://push.superfeedr.com/';
