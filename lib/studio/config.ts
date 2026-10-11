export function isPrivatePreview(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.SITE_MODE === 'preview';
}

export const PREVIEW_ORIGIN = 'https://preview.willie.page';

export function studioOrigin(env: NodeJS.ProcessEnv = process.env): string {
  return env.STUDIO_ORIGIN || PREVIEW_ORIGIN;
}

export const privateHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  Vary: 'Cookie, Cf-Access-Jwt-Assertion',
};
