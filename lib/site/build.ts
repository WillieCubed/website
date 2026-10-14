/** Public provenance compiled into this artifact, never fetched from a latest-run API. */
export interface SiteBuildRecord {
  revision: string | null;
  builtAt: string | null;
  buildUrl: string | null;
  provider: 'cloudflare' | 'github' | null;
  development: boolean;
}

export function siteBuild(): SiteBuildRecord {
  return process.env.SITE_BUILD_RECORD
    ? (JSON.parse(process.env.SITE_BUILD_RECORD) as SiteBuildRecord)
    : {
        revision: null,
        builtAt: null,
        buildUrl: null,
        provider: null,
        development: true,
      };
}
