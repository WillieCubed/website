export type SiteMode = 'hiatus' | 'live';

/** Drafts render in development so they can be previewed, never in production. */
export const showDrafts = process.env.NODE_ENV !== 'production';

export const HIATUS_MESSAGE = 'Willie will return shortly.';

type SiteModeEnv = Record<string, string | undefined>;

/** Live unless SITE_MODE=hiatus opts the site into the placeholder. */
export function getSiteMode(env: SiteModeEnv = process.env): SiteMode {
  return env.SITE_MODE?.toLowerCase() === 'hiatus' ? 'hiatus' : 'live';
}

export function isHiatusMode(env: SiteModeEnv = process.env): boolean {
  return getSiteMode(env) === 'hiatus';
}

export function isLiveMode(env: SiteModeEnv = process.env): boolean {
  return getSiteMode(env) === 'live';
}
