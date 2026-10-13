import { defineWranglerConfig } from 'wrangler/experimental-config';

export default defineWranglerConfig({
  baseDir: '.open-next',
  findAdditionalModules: true,
  rules: [
    {
      type: 'Text',
      globs: [
        'content/**/*.md',
        'content/**/*.mdx',
        'public/search-index.json',
      ],
      fallthrough: true,
    },
    {
      type: 'Data',
      globs: ['brand/fonts/**/*.ttf'],
      fallthrough: true,
    },
  ],
  assetsDirectory: '.open-next/assets',
});
