import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import type { ESLint, Linter } from 'eslint';
import sonarjs from 'eslint-plugin-sonarjs';
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

const esmSyntaxRestrictions = [
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
];

const uiSyntaxRestrictions = [
  ...esmSyntaxRestrictions,
  {
    selector:
      ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression) > :matches(Identifier, ObjectPattern, ArrayPattern, RestElement, AssignmentPattern) TSTypeAnnotation TSTypeLiteral',
    message: 'Declare a named interface for this UI parameter contract.',
  },
  {
    selector:
      ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression) > :matches(Identifier, ObjectPattern, AssignmentPattern) TSTypeAnnotation TSTypeReference[typeName.name=/^(Pick|Omit|Partial|Required|ReturnType|Parameters|Awaited|NonNullable)$/], TSPropertySignature > TSTypeAnnotation TSTypeReference[typeName.name=/^(Pick|Omit|Partial|Required|ReturnType|Parameters|Awaited|NonNullable)$/]',
    message:
      'Use a named domain contract instead of an inline utility type fragment.',
  },
  {
    selector:
      'TSTypeReference[typeName.name=/^(FC|FunctionComponent|ComponentType)$/] > TSTypeParameterInstantiation :matches(TSTypeLiteral, TSTypeReference[typeName.name=/^(Pick|Omit|Partial|Required|ReturnType|Parameters|Awaited|NonNullable)$/]), TSTypeReference[typeName.left.name="React"][typeName.right.name=/^(FC|FunctionComponent|ComponentType)$/] > TSTypeParameterInstantiation :matches(TSTypeLiteral, TSTypeReference[typeName.name=/^(Pick|Omit|Partial|Required|ReturnType|Parameters|Awaited|NonNullable)$/])',
    message: 'Declare a named props interface for this component.',
  },
  {
    selector:
      'CallExpression[callee.name=/^(memo|forwardRef)$/] > TSTypeParameterInstantiation :matches(TSTypeLiteral, TSTypeReference[typeName.name=/^(Pick|Omit|Partial|Required|ReturnType|Parameters|Awaited|NonNullable)$/]), CallExpression[callee.object.name="React"][callee.property.name=/^(memo|forwardRef)$/] > TSTypeParameterInstantiation :matches(TSTypeLiteral, TSTypeReference[typeName.name=/^(Pick|Omit|Partial|Required|ReturnType|Parameters|Awaited|NonNullable)$/])',
    message: 'Declare a named props interface for this component.',
  },

  {
    selector:
      'TSTypeReference[typeName.name=/^(Awaited|NonNullable|ReturnType|Parameters)$/] TSTypeReference[typeName.name=/^(Awaited|NonNullable|ReturnType|Parameters)$/] TSTypeReference[typeName.name=/^(Awaited|NonNullable|ReturnType|Parameters)$/]',
    message:
      'Use a named domain type instead of stacking three or more inference utilities in UI code.',
  },
];

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
    files: ['**/*.{js,jsx,ts,tsx,mjs,mts}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname + '/..',
      },
    },
    rules: {
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        {
          allowNumber: false,
          allowNullableNumber: false,
          allowString: true,
          allowNullableString: true,
          allowNullableBoolean: true,
          allowNullableObject: true,
          allowAny: true,
        },
      ],
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
    // does.
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
    ignores: ['components/link/**'],
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
    plugins: { sonarjs },
    rules: {
      complexity: ['error', 10],
      'sonarjs/cognitive-complexity': ['error', 15],
      'max-depth': ['error', 4],
    },
  },
  {
    files: [
      'app/**/*.{js,jsx,ts,tsx,mjs,mts}',
      'components/**/*.{js,jsx,ts,tsx,mjs,mts}',
    ],
    rules: {
      // Size limits complement responsibility and state-ownership review.
      'max-lines-per-function': [
        'error',
        { max: 150, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      'max-statements': ['error', 30],
    },
  },
  {
    files: [
      'components/writings/StandardSocialControls.tsx',
      'components/writings/StandardSignInDialog.tsx',
      'components/writings/useStandardSocialControls.ts',
      'components/writings/standard-social.ts',
    ],
    rules: { 'no-nested-ternary': 'error' },
  },
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs,mts}'],
    rules: {
      'no-restricted-syntax': ['error', ...esmSyntaxRestrictions],
    },
  },
  {
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      'no-restricted-syntax': ['error', ...uiSyntaxRestrictions],
    },
  },
  {
    files: ['app/**/page.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...uiSyntaxRestrictions,
        {
          selector:
            'TSPropertySignature[key.name="params"] > TSTypeAnnotation > TSTypeReference[typeName.name="Promise"] > TSTypeParameterInstantiation :matches(TSTypeLiteral, TSTypeReference[typeName.name=/^(Pick|Omit|Partial|Required|ReturnType|Parameters|Awaited|NonNullable)$/])',
          message:
            'Use the generated PageProps route helper instead of declaring a params shape by hand.',
        },
      ],
    },
  },
];

export default eslintConfig;
