import {
  entrypointPath,
  sourceManifests,
} from '../../../../support/publishing/runtime.mts';

/** The capture workflow launches these commands in separate processes. */
export function captureSourceManifest() {
  return sourceManifests(
    [
      'atproto-social-capture.mts',
      'publishing-acceptance-setup.mts',
      'atproto-sync.mts',
      'standard-site-acceptance.mts',
      'bluesky-acceptance.mts',
      'atproto-hosted-responses.mts',
      'atproto-social-acceptance.mts',
      'atproto-refresh-acceptance.mts',
    ].map(entrypointPath)
  );
}
