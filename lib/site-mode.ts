export type SiteMode = 'hiatus' | 'live';

export const HIATUS_MESSAGE = 'Willie will return shortly.';

type SiteModeEnv = Record<string, string | undefined>;

export function getSiteMode(env: SiteModeEnv = process.env): SiteMode {
  return env.SITE_MODE?.toLowerCase() === 'live' ? 'live' : 'hiatus';
}

export function isHiatusMode(env: SiteModeEnv = process.env): boolean {
  return getSiteMode(env) === 'hiatus';
}

export function isLiveMode(env: SiteModeEnv = process.env): boolean {
  return getSiteMode(env) === 'live';
}
