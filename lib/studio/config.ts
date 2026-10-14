import { StudioError } from './errors';

export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new StudioError(503, `${name} is not configured.`);
  return value;
}

export function isPrivatePreview(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.SITE_MODE === 'preview';
}

export const PREVIEW_ORIGIN = 'https://preview.willie.page';

export function studioOrigin(
  env: Record<string, string | undefined> = process.env
): string {
  return env.STUDIO_ORIGIN || PREVIEW_ORIGIN;
}

export const privateHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  Vary: 'Cookie, Cf-Access-Jwt-Assertion',
};
