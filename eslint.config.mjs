import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import noRawInternalAnchor from './eslint/no-raw-internal-anchor.mjs';

const sitePlugin = {
  meta: { name: 'site' },
  rules: { 'no-raw-internal-anchor': noRawInternalAnchor },
};

const eslintConfig = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.vercel/**',
      'out/**',
      'build/**',
      'public/pagefind/**',
      'test-results/**',
      'playwright-report/**',
      'next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  nextPlugin.configs.recommended,
  nextPlugin.configs['core-web-vitals'],
  {
    files: [
      '*.config.{js,cjs,mjs,ts}',
      '.*rc.{js,mjs}',
      'brand/**/*.mjs',
      'scripts/**/*.{js,mjs,ts,mts}',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Every in-site link goes through SiteLink so it gets the hover card and
    // one navigation behaviour. See docs/links.md.
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
    ignores: ['components/link/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next/link',
              message:
                'Use SiteLink from @/components/link/SiteLink so in-site links get hover cards (docs/links.md).',
            },
          ],
        },
      ],
    },
  },
  {
    // An anchor written by hand skips SiteLink just as a next/link import
    // does. The parked pages under app/_(pages) are not routed, so they are
    // left for their rebuild.
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
    ignores: ['components/link/**', 'app/_(pages)/**'],
    plugins: { site: sitePlugin },
    rules: {
      'site/no-raw-internal-anchor': 'error',
    },
  },
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs,cjs}'],
    rules: {
      // TODO: Remove once codebase is in a better state.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];

export default eslintConfig;
