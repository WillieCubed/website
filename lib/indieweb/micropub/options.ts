import type { IndieAuthStore } from '@/lib/indieweb/indieauth/types';

import type { MicropubArchiveStore } from './archive';
import type { PrivateMicropubOptions } from './studio-adapter';
import type { MicropubRouteEnvironment } from './types';

/** What the handlers use, each replaceable in tests. */
export interface MicropubEndpointOptions extends PrivateMicropubOptions {
  /** Where issued tokens live; the Postgres store by default. */
  store?: IndieAuthStore;
  environment?: MicropubRouteEnvironment;
  archives?: MicropubArchiveStore;
  /** Used for GitHub's Contents API. */
  fetch?: typeof fetch;
  /** Tags of the published writings, for q=category. */
  publishedTags?: () => Promise<string[]>;
  /** The request time an update records as `lastUpdated`. */
  now?: () => Date;
}

export function micropubEnvironment(
  env: NodeJS.ProcessEnv = process.env
): MicropubRouteEnvironment {
  return {
    githubRepository: env.STUDIO_GITHUB_REPOSITORY,
    githubToken: env.STUDIO_GITHUB_TOKEN,
    defaultBranch: env.STUDIO_GITHUB_BRANCH ?? 'main',
    contentPath: env.MICROPUB_CONTENT_PATH ?? 'content/writings',
  };
}
