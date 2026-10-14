import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import type { ESLint, Linter } from 'eslint';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { hashComments, stylesheetComments } from './code-comments.mts';
import dependencyBoundaries from './dependency-boundaries.mts';
import noFileReferences from './no-file-references.mts';
import noRawInternalAnchor from './no-raw-internal-anchor.mts';

const sitePlugin: ESLint.Plugin = {
  meta: { name: 'site' },
  processors: {
    'stylesheet-comments': stylesheetComments,
    'hash-comments': hashComments,
  },
  rules: {
    'no-raw-internal-anchor': noRawInternalAnchor,
    'dependency-boundaries': dependencyBoundaries,
    'no-file-references': noFileReferences,
  },
};

const eslintConfig: Linter.Config[] = [
  {
    ignores: [
      'node_modules/**',
      '.superpowers/**',
      '.next/**',
      '.open-next/**',
      '.cloudflare/**',
      '.wrangler/**',
      '.studio/**',
      '.generated/**',
      '.playwright-mcp/**',
      '.vercel/**',
      'out/**',
      'build/**',
      'public/pagefind/**',
      'test-results/**',
      'playwright-report/**',
      'next-env.d.ts',
      'cloudflare-env.d.ts',
      'lib/content/generated-content.ts',
      'lib/mdx/generated.tsx',
    ],
  },
  {
    plugins: { site: sitePlugin },
    rules: {
      'site/dependency-boundaries': 'error',
      'site/no-file-references': 'error',
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  nextPlugin.configs.recommended,
  nextPlugin.configs['core-web-vitals'],
  {
    files: ['**/*.css'],
    processor: 'site/stylesheet-comments',
  },
  {
    files: ['**/*.{sh,yml,yaml}', 'tests/**/*.env'],
    processor: 'site/hash-comments',
  },
  {
    files: [
      '*.config.{js,mjs,ts,mts}',
      '.*rc.{js,mjs}',
      'brand/**/*.mjs',
      'scripts/**/*.{js,mjs,ts,mts}',
      'tests/{support,fixtures}/**/*.{js,mjs,mts}',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Every in-site link goes through SiteLink so it gets the hover card and
    // one navigation behaviour.
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
    ignores: ['components/link/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next/link',
              message: 'Use SiteLink so in-site links get hover cards.',
            },
          ],
        },
      ],
    },
  },
  {
    // An anchor written by hand skips SiteLink just as a next/link import
    // does. Parked pages are not routed, so they are
    // left for their rebuild.
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
    ignores: ['components/link/**', 'app/_(pages)/**'],
    rules: {
      'site/no-raw-internal-anchor': 'error',
    },
  },
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs,mts}'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs,mts}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.name="require"]',
          message: 'Use ESM imports in this repository.',
        },
        {
          selector:
            'AssignmentExpression[left.object.name="module"][left.property.name="exports"]',
          message: 'Use ESM exports in this repository.',
        },
        {
          selector: 'AssignmentExpression[left.object.name="exports"]',
          message: 'Use ESM exports in this repository.',
        },
      ],
    },
  },
];

export default eslintConfig;
