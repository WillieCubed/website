import { repositoryRoot } from './shared/command.mts';
import {
  preparationConfiguration,
  prepareArtifact,
} from './shared/preparation.mts';

// Search must use the same production loaders even when MDX is reused.
Object.assign(process.env, { NODE_ENV: 'production' });

const generated = [
  'lib/mdx/generated.tsx',
  'lib/content/generated-content.ts',
  'public/_content-images',
];
const tools = [
  'package.json',
  'pnpm-lock.yaml',
  'node_modules/.pnpm/lock.yaml',
  'tsconfig.json',
  '.prettierrc.mjs',
  'next.config.ts',
  'scripts/prepare.mts',
  'scripts/shared',
];
const configuration = preparationConfiguration(process.env);

async function prepare(
  name: string,
  inputs: string[],
  outputs: string[],
  generate: () => Promise<void>
) {
  await prepareArtifact({
    root: repositoryRoot,
    name,
    inputs: [...tools, ...inputs],
    outputs,
    exclude: generated,
    configuration,
    generate,
  });
}

await prepare(
  'studio',
  ['scripts/studio/build-runtime.mts'],
  ['.studio/browser-runtime.js', '.studio/browser-runtime.ts'],
  async () => (await import('./studio/build-runtime.mts')).buildStudioRuntime()
);
await prepare(
  'mdx',
  ['content', 'lib', 'scripts/cloudflare/generate-mdx.mts'],
  ['lib/mdx/generated.tsx'],
  async () => (await import('./cloudflare/generate-mdx.mts')).generateMdx()
);
await prepare(
  'search',
  ['content', 'lib', 'scripts/search/generate-index.mts'],
  ['public/search-index.json', 'public/pagefind'],
  async () => (await import('./search/generate-index.mts')).runSearchIndex()
);
await prepare(
  'content',
  [
    'content',
    'public',
    'brand/fonts',
    'scripts/cloudflare/generate-content-manifest.mts',
    'scripts/content/public-images.mts',
  ],
  ['lib/content/generated-content.ts', 'public/_content-images'],
  async () =>
    (
      await import('./cloudflare/generate-content-manifest.mts')
    ).generateContentManifest()
);
