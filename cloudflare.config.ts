import { bindings, defineConfig, exports, triggers } from 'cf/config';

const accountId = '18f90fa11cf0a87145be4a1517e41217';

export default defineConfig((context) => {
  const preview = context.mode === 'preview';
  const name = preview ? 'willie-page-preview' : 'willie-page';

  return {
    accountId,
    worker: {
      name,
      compatibilityDate: '2026-10-13',
      compatibilityFlags: ['nodejs_compat', 'global_fetch_strictly_public'],
      entrypoint: '.open-next/worker.js',
      workersDev: true,
      previewUrls: true,
      observability: { enabled: true },
      ...(preview
        ? {}
        : {
            domains: [
              'willie.page',
              'www.willie.page',
              'tour.willie.page',
              'diaries.willie.page',
              'www.williecubed.me',
            ],
            triggers: [
              triggers.fetch({
                pattern: 'williecubed.me/*',
                zone: 'williecubed.me',
              }),
            ],
          }),
      env: {
        ATPROTO_PUBLICATION_RKEY: bindings.text('3mwxne5td6lid'),
        MICROPUB_GITHUB_REPO: bindings.text('WillieCubed/website'),
        MICROPUB_GITHUB_BRANCH: bindings.text('main'),
        HYPERDRIVE: bindings.hyperdrive({
          id: preview
            ? '0b5d616d4c994fa5ac27afcea7ddfdaf'
            : '22d2802570684a09a567d3f41c3f5ff1',
        }),
        NEXT_INC_CACHE_R2_BUCKET: bindings.r2({
          name: preview ? 'willie-page-preview-cache' : 'willie-page-cache',
        }),
        MEDIA_BUCKET: bindings.r2({
          name: preview ? 'willie-page-preview-media' : 'willie-page-media',
        }),
        WEBMENTION_EDGE_LIMIT: bindings.rateLimit({
          namespace: preview ? '66131002' : '66131001',
          simple: { limit: 10, period: 60 },
        }),
        WORKER_SELF_REFERENCE: bindings.worker({ worker: name }),
        NEXT_CACHE_DO_QUEUE: bindings.durableObject({
          worker: name,
          exportName: 'DOQueueHandler',
        }),
        NEXT_TAG_CACHE_DO_SHARDED: bindings.durableObject({
          worker: name,
          exportName: 'DOShardedTagCache',
        }),
        IMAGES: bindings.images({}),
        ASSETS: bindings.assets(),
        ATPROTO_OAUTH_JWK: bindings.secret(),
        ATPROTO_OAUTH_STORAGE_KEY: bindings.secret(),
        WEBMENTION_SECRET: bindings.secret(),
        WEBMENTION_MODERATION_SECRET: bindings.secret(),
        INDIEAUTH_INTROSPECTION_SECRET: bindings.secret(),
        INDIEWEB_NOTIFY_SECRET: bindings.secret(),
        SEARCH_REINDEX_SECRET: bindings.secret(),
        ...(preview
          ? {}
          : {
              OWNER_ACCESS_ISSUER: bindings.secret(),
              OWNER_ACCESS_AUDIENCE: bindings.secret(),
              OWNER_ACCESS_EMAIL: bindings.secret(),
            }),
        MICROPUB_GITHUB_TOKEN: bindings.secret(),
        ATPROTO_APP_PASSWORD: bindings.secret(),
      },
      exports: {
        DOQueueHandler: exports.durableObject({ storage: 'sqlite' }),
        DOShardedTagCache: exports.durableObject({ storage: 'sqlite' }),
      },
    },
  };
});
