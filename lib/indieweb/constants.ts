import { site } from '@/lib/site';

export const SITE_URL = site.origin;
export const SITE_NAME = site.name;
export const SITE_AUTHOR_EMAIL = site.author.email;
export const SITE_AUTHOR_HANDLE = site.author.handle;
export const AT_PROTOCOL_DID = site.author.atprotoDid;
export const INDIEAUTH_AUTHORIZATION_ENDPOINT = 'https://indieauth.com/auth';
export const INDIEAUTH_TOKEN_ENDPOINT = 'https://indieauth.com/token';
export const WEBMENTION_ENDPOINT = '/webmention';
export const MICROPUB_ENDPOINT = '/micropub';
export const PUBLIC_WEBMENTIONS_ENDPOINT = '/webmentions';
export const OEMBED_ENDPOINT = '/oembed';
export const WEBSUB_HUB = 'https://pubsubhubbub.appspot.com/';
